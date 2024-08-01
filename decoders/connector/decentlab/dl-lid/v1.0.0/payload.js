/*
* FILENAME : dl-lid.js
*
* DESCRIPTION : Decentlab DL-LID
*
*
* FUNCTIONS : read_int, decode, ToTagoFormat, adjustObjectFormat
*
*
* NOTES :
*
* AUTHOR : Decentlab          START DATE : 08/01/2024
*
* CHANGES :
*
* REF NO  VERSION DATE    WHO           DETAIL
* 1.0     08/01/2024      Decentlab     implementing DL-LID
*
*
*/

/* https://www.decentlab.com/products/laser-distance-level-sensor-for-lorawan */

var decentlab_decoder = {
  PROTOCOL_VERSION: 2,
  SENSORS: [
    {length: 11,
     values: [{name: 'distance_average',
               displayName: 'Distance: average',
               convert: function (x) { return x[0]; },
               unit: 'mm'},
              {name: 'distance_minimum',
               displayName: 'Distance: minimum',
               convert: function (x) { return x[1]; },
               unit: 'mm'},
              {name: 'distance_maximum',
               displayName: 'Distance: maximum',
               convert: function (x) { return x[2]; },
               unit: 'mm'},
              {name: 'distance_median',
               displayName: 'Distance: median',
               convert: function (x) { return x[3]; },
               unit: 'mm'},
              {name: 'distance_10th_percentile',
               displayName: 'Distance: 10th percentile',
               convert: function (x) { return x[4]; },
               unit: 'mm'},
              {name: 'distance_25th_percentile',
               displayName: 'Distance: 25th percentile',
               convert: function (x) { return x[5]; },
               unit: 'mm'},
              {name: 'distance_75th_percentile',
               displayName: 'Distance: 75th percentile',
               convert: function (x) { return x[6]; },
               unit: 'mm'},
              {name: 'distance_90th_percentile',
               displayName: 'Distance: 90th percentile',
               convert: function (x) { return x[7]; },
               unit: 'mm'},
              {name: 'distance_most_frequent_value',
               displayName: 'Distance: most frequent value',
               convert: function (x) { return x[8]; },
               unit: 'mm'},
              {name: 'number_of_samples',
               displayName: 'Number of samples',
               convert: function (x) { return x[9]; }},
              {name: 'total_acquisition_time',
               displayName: 'Total acquisition time',
               convert: function (x) { return x[10] / 1.024; },
               unit: 'ms'}]},
    {length: 1,
     values: [{name: 'battery_voltage',
               displayName: 'Battery voltage',
               convert: function (x) { return x[0] / 1000; },
               unit: 'V'}]}
  ],

  read_int: function (bytes, pos) {
    return (bytes[pos] << 8) + bytes[pos + 1];
  },

  decode: function (msg) {
    var bytes = msg;
    var i, j;
    if (typeof msg === 'string') {
      bytes = [];
      for (i = 0; i < msg.length; i += 2) {
        bytes.push(parseInt(msg.substring(i, i + 2), 16));
      }
    }

    var version = bytes[0];
    if (version != this.PROTOCOL_VERSION) {
      return {error: "protocol version " + version + " doesn't match v2"};
    }

    var deviceId = this.read_int(bytes, 1);
    var flags = this.read_int(bytes, 3);
    var result = {'protocol_version': version, 'device_id': deviceId};
    // decode payload
    var pos = 5;
    for (i = 0; i < this.SENSORS.length; i++, flags >>= 1) {
      if ((flags & 1) !== 1)
        continue;

      var sensor = this.SENSORS[i];
      var x = [];
      // convert data to 16-bit integer array
      for (j = 0; j < sensor.length; j++) {
        x.push(this.read_int(bytes, pos));
        pos += 2;
      }

      // decode sensor values
      for (j = 0; j < sensor.values.length; j++) {
        var value = sensor.values[j];
        if ('convert' in value) {
          result[value.name] = {displayName: value.displayName,
                                value: value.convert.bind(this)(x)};
          if ('unit' in value)
            result[value.name]['unit'] = value.unit;
        }
      }
    }
    return result;
  }
};

function adjustObjectFormat (result){
  for (const key_aux of result){
    // drop undefined fields
    if (typeof key_aux.unit === 'undefined'){
      delete key_aux.unit;
    }
    if (typeof key_aux.value === 'undefined'){
      delete key_aux.value;
    }
    // limit value to 2 decimal places
    if (typeof key_aux.value === 'number'){
      key_aux.value = Number(key_aux.value.toFixed(2));
    }
  }
  return result;
}

function ToTagoFormat(object_item, serie, prefix = "") {
  let result = [];
  for (const key in object_item) {
    if (typeof object_item[key] === "object") {
      result.push({
        variable: (object_item[key].MessageType || `${prefix}${key}`).toLowerCase(),
        value: object_item[key].value || object_item[key].Value,
        serie: object_item[key].serie || serie,
        // metadata: object_item[key].metadata,
        unit: object_item[key].unit,
        // location: object_item.location,
      });
    } else {
      result.push({
        variable: `${prefix}${key}`.toLowerCase(),
        value: object_item[key],
        serie,
      });
    }
  }

  result = adjustObjectFormat(result);
  return result;
}

const payload_raw = payload.find((x) => x.variable === "payload_raw" || x.variable === "payload" || x.variable === "data");
if (payload_raw) {
  try {
    // Convert the data from Hex to Javascript Buffer.
    const buffer = Buffer.from(payload_raw.value, "hex");
    const serie = new Date().getTime();
    if (decentlab_decoder.PARAMETERS) {
      device.params.forEach((p) => {
        if (p.key in decentlab_decoder.PARAMETERS) {
          decentlab_decoder.PARAMETERS[p.key] = p.value;
        }
      });
    }
    const payload_aux = ToTagoFormat(decentlab_decoder.decode(buffer));
    payload = payload.concat(payload_aux.map((x) => ({ ...x, serie })));
  } catch (e) {
    // Print the error to the Live Inspector.
    console.error(e);
    // Return the variable parse_error for debugging.
    payload = [{ variable: "parse_error", value: e.message }];
  }
}
