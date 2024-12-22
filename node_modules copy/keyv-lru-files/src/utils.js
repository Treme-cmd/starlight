const path = require("path");

module.exports = {
  // make filename parameter safe
  sanitize: function(f) {
    return path.normalize(f).replace(/^\//, '');
  },

  // convert human-readable filesize to an integer of bytes
  filesize: function(s) {
    if (typeof s === "number") return s;
    if (typeof s !== "string") return 0;
    var match = s.toLowerCase().match(/^([0-9]+([\.,]([0-9]+))?)(\s*)([a-z]+)?$/);
    if (!match) return 0;
    var num = parseFloat(match[1].replace(/,/, '.'));
    switch (match[5]) {
      case "k":
      case "kb":
      case "kbyte":
        return Math.round(num * Math.pow(10, 3));
        break;
      case "m":
      case "mb":
      case "mbyte":
        return Math.round(num * Math.pow(10, 6));
        break;
      case "g":
      case "gb":
      case "gbyte":
        return Math.round(num * Math.pow(10, 9));
        break;
      case "t":
      case "tb":
      case "tbyte":
        return Math.round(num * Math.pow(10, 12));
        break;
      case "p":
      case "pb":
      case "pbyte":
        // be aware that javascript can't represent much more than 9 of those because integers are only 2^53
        return Math.round(num * Math.pow(10, 15));
        break;
      case "ki":
      case "kib":
      case "kibi":
      case "kibyte":
      case "kibibyte":
        return Math.round(num * Math.pow(2, 10));
        break;
      case "mi":
      case "mib":
      case "mebi":
      case "mibyte":
      case "mebibyte":
        return Math.round(num * Math.pow(2, 20));
        break;
      case "gi":
      case "gib":
      case "gibi":
      case "gibyte":
      case "gibibyte":
        return Math.round(num * Math.pow(2, 30));
        break;
      case "ti":
      case "tib":
      case "tebi":
      case "tibyte":
      case "tebibyte":
        return Math.round(num * Math.pow(2, 40));
        break;
      case "pi":
      case "pib":
      case "pebi":
      case "pibyte":
      case "pebibyte":
        // be aware that javascript can't represent more than 8 of those because integers are only 2^53
        return Math.round(num * Math.pow(2, 50));
        break;
      default:
        // everything else is treated as bytes
        return Math.round(num);
        break;
    }
  }
};
