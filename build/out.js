(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var _ = require('underscore');

var grid = require('./components/grid.js');
var GridModel = require('./components/gridmodel.js');

window.randomData = require('./components/dummydata.js');

if (!window.fin) {
    window.fin = {};
    window.fin.hypergridlite = {
        createOn: grid,
        GridModel: GridModel
    };
}

module.exports.foo = 'foo';
},{"./components/dummydata.js":7,"./components/grid.js":9,"./components/gridmodel.js":10,"underscore":3}],2:[function(require,module,exports){
;(function () {
  'use strict';

  /**
   * export SimpleLRU for CommonJS, AMD
   */
  if (typeof define === "function" && define.amd) {
    define(function () {
      return SimpleLRU;
    });
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleLRU;
  } else if (typeof window !== 'undefined') {
    window.SimpleLRU = SimpleLRU;
  }

  SimpleLRU.version = '0.0.3';

  /**
   * Simple mixin utility
   * @api private
   */
  function extend(obj1, obj2) {
    for (var key in obj2) obj1[key] = obj2[key];
  }

  var nativeCreate = Object.create;

  /**
   * Object data store
   * this is a `Object.create` fallback in order to support IE8
   * @api private
   */
  var Data = (function () {
    var Data, proto;

    if (typeof nativeCreate === 'function') {
      Data = function () {
        this.data = nativeCreate(null);
      };

      proto = {
        get: function (key) {
          return this.data[key];
        },
        has: function (key) {
          return !! this.data[key];
        }
      };

    } else {
      Data = function () {
        this.data = {};
      };

      proto = {
        get: function (key) {
          if (this.has(key)) return this.data[key];
        },
        has: function (key) {
          return Object.prototype.hasOwnProperty.call(this.data, key);
        }
      };
    }

    extend(proto, {
      set: function (key, val) {
        this.data[key] = val;
      },
      del: function (key) {
        var val = this.get(key);
        if (typeof val !== 'undefined') {
          delete this.data[key];
          return val;
        }
      }
    });

    extend(Data.prototype, proto);

    return Data;
  })();

  /**
   * Cache entry instance
   *
   * @param {String}
   * @param {any}
   * @param {Number}
   * @api private
   */
  function Entry(key, val, index) {
    this.key = key;
    this.val = val;
    this.index = index;
  }

  /**
   * SimpleLRU constructor
   * It holds following private properties. See `#reset()`
   *
   *   _byKey    {Data}    map by key
   *   _byOrder  {Object}  map by recently used order
   *   _head     {Number}  index of next entry
   *   _tail     {Number}  index of least recently used cache item
   *   _len      {Number}  total number of cache items
   *
   * `_tail` is an index of the least recently used cache item.
   * `_head` is an index of the most recently used cache item *plus* one.
   *
   * @param {Number} max length of cache item
   */
  function SimpleLRU(max) {
    if (typeof max !== 'number') throw new TypeError('max is requried');
    this.max(max);
    this.reset();
  }

  extend(SimpleLRU.prototype, {

    /**
     * Set cache by key
     * @param {String} unique string key
     * @param {String|Object|Number} any value
     */
    set: function (key, val) {
      var entry = this._byKey.get(key);

      // reuse entry if the key exists
      if (entry) {
        this._touch(entry);
        entry.val = val;
        return;
      }

      entry = new Entry(key, val, this._head++);
      this._byKey.set(key, entry);
      this._byOrder[entry.index] = entry;
      this._len++;
      this._trim();
    },

    /**
     * delete cache by key
     *
     * @param {String}
     * @return {String|Object|Number} cached value
     */
    del: function (key) {
      var entry = this._byKey.del(key);
      if (!entry) return;

      delete this._byOrder[entry.index];
      this._len--;

      if (this._len === 0) {
        this._head = this._tail = 0;
      } else {
        // update most index if it was most lecently used entry
        if (entry.index === this._head - 1) this._pop();
        // update least index if it was least lecently used entry
        if (entry.index === this._tail) this._shift();
      }

      return entry.val;
    },

    /**
     * get cache by key
     *
     * @param {String}
     * @return {any} cache if it exists
     */
    get: function (key) {
      var entry = this._byKey.get(key);
      if (entry) {
        this._touch(entry);
        return entry.val;
      }
    },

    /**
     * get a cache by key without touching index
     * @return {any}
     */
    peek: function (key) {
      var entry = this._byKey.get(key);
      if (entry) return entry.val;
    },

    /**
     * see if key is exists or not
     * @return {Boolean}
     */
    has: function (key) {
      return this._byKey.has(key);
    },

    /**
     * total number of cache
     * @return {Number}
     */
    length: function () {
      return this._len;
    },

    /**
     * clear all stored cache
     */
    reset: function () {
      this._byKey = new Data();
      this._byOrder = nativeCreate ? nativeCreate(null) : {};
      this._head = 0;
      this._tail = 0;
      this._len = 0;
    },

    /**
     * Getter|Setter function of "max" option
     * @param {Number} if setter
     */
    max: function (max) {
      if (typeof max !== 'number') return this._max;
      if (max < 1) throw new TypeError('max should be a positive number');
      var shrink = (this._max || 0) > max;
      this._max = max;
      if (shrink) this._trim();
    },

    /**
     * return array of keys in least recently used order
     * @return {Array}
     */
    keys: function () {
      var count = 0
        , tail = this._tail
        , head = this._head
        , keys = new Array(this._len);

      for (var i = tail; i < head; i++) {
        var entry = this._byOrder[i];
        if (entry) keys[count++] = entry.key;
      }

      return keys;
    },

    /**
     * update least recently used index of an entry to "_head"
     *
     * @param {Entry}
     * @api private
     */
    _touch: function (entry) {
      // update most number to key
      if (entry.index !== this._head - 1) {
        var isTail = entry.index === this._tail;
        delete this._byOrder[entry.index];
        entry.index = this._head++;
        this._byOrder[entry.index] = entry;
        if (isTail) this._shift();
      }
    },

    /**
     * trim entries
     * @api private
     */
    _trim: function () {
      var max = this._max;
      while (max < this._len) {
        var tailEntry = this._byOrder[this._tail];
        this.del(tailEntry.key);
      }
    },

    /**
     * update tail index
     * @return {Entry|undefined}
     * @api private
     */
    _shift: function () {
      var tail = this._tail
        , head = this._head;
      for (var i = tail; i < head; i++) {
        var entry = this._byOrder[i];
        if (entry) {
          this._tail = i;
          return entry;
        }
      }
    },

    /**
     * update head index
     * @return {Entry|undefined}
     * @api private
     */
    _pop: function () {
      var tail = this._tail
        , head = this._head;
      for (var i = head - 1; i >= tail; i--) {
        var headEntry = this._byOrder[i];
        if (headEntry) {
          this._head = i + 1;
          return headEntry;
        }
      }
    }
  });

})();
},{}],3:[function(require,module,exports){
//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}],4:[function(require,module,exports){
/**
 * given an array of numbers, return the index at which the value would fall
 * summing the array as you go
 * @param  {array} arr array of numbers
 * @param  {number} val get the index where this would fall
 * @return {number}     index or -1 if not found
 */
function contains(arr, val) {
    var total = 0,
        len = arr.length,
        i;

    for (i = 0; i < len; i++) {
        total += arr[i];

        if (val < total) {
            return i;
        }
    }

    return -1;
}


/**
 * consult the nearest kindergarten teacher...
 */
function add(a, b) {
    return a + b;
}

/**
 * sum until the given index
 * @param  {array} arr array to partial sum
 * @param  {number} idx index
 * @return {number}     partial sum
 */
function partialSum(arr, idx) {
    var subset = arr.slice(0, idx);

    return subset.reduce(add, 0);
}


/**
 * map over an array returning an array of the same length containing the
 * sum at each place
 * @param  {array} arr an array of numbers
 * @return {array}     the array of sums
 */
function runningSums(arr) {
    var sum = 0;

    return arr.map(function(item) {
        return sum += item;
    });
}


/**
 * given an array of boarders, generate a set of x-coords that represents the
 * the area around the boarders +/- the threshold given
 * @param  {array} arr    array of borders
 * @param  {number} thresh the threshold around each
 * @return {array}        an array of arrays
 */
function genFuzzyBorders(arr, thresh) {
    var len = arr.length,
        borders = [
            [0, thresh]
        ],
        maxRight = arr.reduce(add, 0),
        sums = runningSums(arr),
        i, curr;

    for (i = 0; i < len; i++) {
        curr = sums[i];

        borders.push([
            Math.max(0, curr - thresh),
            Math.min(curr + thresh, maxRight)
        ]);
    }

    return borders
}


/**
 * A version of the findIndex polyfill found here:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
 *
 * adapted to run as stand alone function
 */
function findIndex(lst, predicate) {

    var list = Object(lst);
    var length = list.length >>> 0;
    var value;

    for (var i = 0; i < length; i++) {
        value = list[i];
        if (predicate.call(null, value, i, list)) {
            return i;
        }
    }
    return -1;
};


function inRange(range, value) {
    return value >= range[0] && value <= range[1];
}

/**
 * return whatever gets passed in. can be useful in a filter function where
 * truthy values are the only valid ones
 * @param  {any} arg any value
 * @return {any}     whatever was passed in
 */
function identity(arg) {
    return arg;
}

/**
 * move an array index to the 'border' passed in. the borders are not array
 * indexes, they are the numbers in the following diagram:
 *
 * |0|____val____|1|_____val_____|2|_____val____|3| etc
 *
 * ** All column values are assumed to be truthy (objects in mind...) **
 *
 * @param  {array} arr      array to reorder, not mutated
 * @param  {number} from     normal index of column to move
 * @param  {number} toBorder border index
 * @return {array}          new array in new order
 */
function moveIdx(arr, from, toBorder) {
    var reorderd = arr.slice(),
        mover = reorderd.splice(from, 1, undefined)[0];

    reorderd.splice(toBorder, 1, mover, reorderd[toBorder]);

    return reorderd.filter(identity);
}





function init(self, divHeader) {

    var gridEvents = require('./events').gridEvents;


    var widths = self.getColumns().map(function(col) {
            return col.getWidth();
        }),
        resizeThresh = 5,
        fuzzyBorders = genFuzzyBorders(widths, resizeThresh),
        inserter = document.createElement('div'),
        headerCanvas = self.getHeaderCanvas(),
        headerRect = headerCanvas.getBoundingClientRect(),
        dragHeader, mouseDown, x, y, startingTrans, resizing,
        resizingCols, clickedCol, borderHit, reordering,
        lastX = null;




    inserter.style.height = '20px';
    inserter.style.width = '5px';
    inserter.style.backgroundColor = 'goldenrod';
    inserter.style.position = 'absolute';
    inserter.style.display = 'none';
    inserter.top = 0;
    inserter.left = 0;

    document.body.appendChild(inserter);


    gridEvents.mousemove.addObserver(mousemove);
    gridEvents.mouseup.addObserver(mouseup);
    divHeader.addEventListener('mousedown', mousedown);

    function mousemove(e) {
        var xMovement, yMovement, movementString,
            left = headerRect.left,
            rangeFunc, normalizedBorders,
            inserterLeft, activeCol, activeColWidth,
            colResizeIndex;

        widths = self.getColumns().map(function(col) {
            return col.getWidth();
        });

        fuzzyBorders = genFuzzyBorders(widths, resizeThresh),

        rangeFunc = function(range) {
            return inRange(range, e.clientX);
        }

        normalizedBorders = fuzzyBorders.map(function(item) {
            return item.map(add.bind(null, left));
        })

        if (!resizing) {
            borderHit = findIndex(normalizedBorders, rangeFunc);
        }

        if ( ( resizing || (borderHit !== -1)) && !reordering ) {
            divHeader.style.cursor = 'col-resize';
            resizingCols = true;

            if (mouseDown) {
                if (borderHit > 0) {
                    colResizeIndex = clickedCol;
                    activeCol = self.getColumns()[colResizeIndex];
                    activeColWidth = activeCol.getWidth();
                    activeCol.setWidth(Math.max(0, activeColWidth + (e.clientX - x)));
                    self.paintAll();
                    resizing = true;
                    x = e.clientX;
                }


            }
        } else if (mouseDown 
            && dragHeader 
            && (e.clientX >= headerRect.left) 
            && (e.clientX <= (headerRect.left + headerRect.width)) 
            && !resizingCols) {

            reordering = true;

            if (e.target !== dragHeader) {
                return;
            }


            xMovement = startingTrans[0] - (x - e.clientX);
            yMovement = 0;
            lastX = e.clientX;

            movementString = ['translateX(',
                xMovement,
                'px) translateY(',
                yMovement,
                'px)'
            ].join('');

            dragHeader.style.transform = movementString;
            dragHeader.style.webkitTransform = movementString;
            dragHeader.style.zIndex = 10;

            if (borderHit !== -1) {
                inserterLeft = normalizedBorders[borderHit][0];
                inserter.style.left = inserterLeft;
                inserter.style.top = headerRect.top;
                inserter.style.display = 'block';
            } else {
                inserter.style.display = 'none';
            }
        } else {
            divHeader.style.cursor = 'auto';
            resizingCols = false;
        }
    }


    function mouseup(e) {
        var reordered;

        e.preventDefault();

        x = y  = 0;

        lastX = null;

        if (dragHeader) {
            dragHeader.parentNode.removeChild(dragHeader);
        }

        dragHeader = null;
        startingTrans = [0, 0];
        mouseDown = false;
        resizing = false;
        reordering = false;

        if (borderHit !== -1
            && (e.clientY >= headerRect.top) 
            && (e.clientY <= (headerRect.top + headerRect.height)) ) {
            reordered = moveIdx(self.getColumns(), clickedCol, borderHit);
            self.setColumns(reordered);
            self.paintAll();
        }

        inserter.style.display = 'none';
        headerRect = headerCanvas.getBoundingClientRect();
        fuzzyBorders = genFuzzyBorders(widths, resizeThresh);
        widths = self.getColumns().map(function(col) {
            return col.getWidth();
        });

    }


    function mousedown(e) {

        mouseDown = true;

        widths = self.getColumns().map(function(col) {
            return col.getWidth();
        });

        clickedCol = contains(widths, e.offsetX);

        x = e.clientX;
        y = e.y;


        if (resizingCols) {
            // always resize l to r 
            clickedCol = contains(widths, e.offsetX - resizeThresh);
            return; // gross....
        }

        var colOffset = partialSum(widths, clickedCol),
            image = new Image(),
            subCanvas = document.createElement('canvas'),
            subCtx = subCanvas.getContext('2d'),
            clickedColWidth = widths[clickedCol],
            transform, ctx;

        // body is prob not the best spot for this... 
        document.body.appendChild(subCanvas);

        headerRect = headerCanvas.getBoundingClientRect();
        fuzzyBorders = genFuzzyBorders(widths, resizeThresh);

        ctx = headerCanvas.getContext('2d');

        subCanvas.width = clickedColWidth;
        subCanvas.height = 20;
        subCanvas.style.opacity = '.45';
        subCanvas.style.position = 'absolute';
        subCanvas.style.left = e.clientX - (e.offsetX - colOffset);
        subCanvas.style.top = headerRect.top;
        subCanvas.style.cursor = 'pointer';

        subCtx.drawImage(
            headerCanvas,
            colOffset, // sx, 
            0, // sy, 
            clickedColWidth, // sWidth, 
            20, // sHeight, 
            0, // dx, 
            0, // dy, 
            clickedColWidth,
            20);


        dragHeader = subCanvas;

        transform = dragHeader.style.transform;

        startingTrans = transform.match(/([^(]?\d+)/g) || [0, 0];
    }

}

exports.init = init;
},{"./events":8}],5:[function(require,module,exports){
'use strict';

var defaultRenderer = require('./defaultcellrenderer.js');

var Column = function(grid, field, label, type, width, renderer) {

    renderer = renderer || defaultRenderer;

    this.getGrid = function() {
        return grid;
    };

    this.setGrid = function(newGrid) {
        grid = newGrid;
    };

    this.getField = function() {
        return field;
    };

    this.setField = function(newField) {
        field = newField;
    };

    this.getLabel = function() {
        return label;
    };

    this.setLabel = function(newLabel) {
        label = newLabel;
    };

    this.getType = function() {
        return type;
    };

    this.setType = function(newType) {
        type = newType;
    };

    this.getRenderer = function() {
        return renderer;
    };

    this.setRenderer = function(newRenderer) {
        renderer = newRenderer;
    };

    this.getWidth = function() {
        return width;
    };

    this.setWidth = function(newWidth) {
        width = newWidth;
    };
};



module.exports = Column;
},{"./defaultcellrenderer.js":6}],6:[function(require,module,exports){
'use strict';


var paint = function(gc, config) {

    var value = config.value;
    var bounds = config.bounds;

    var x = bounds.x;
    var y = bounds.y;
    var width = bounds.width;
    var height = bounds.height;
    var font = config.font;

    var halign = config.halign || 'right';
    var valignOffset = config.voffset || 0;

    var cellPadding = config.cellPadding || 0;
    var halignOffset = 0;
    var textWidth = config.getTextWidth(gc, value);
    var fontMetrics = config.getTextHeight(font);

    if (gc.font !== config.font) {
        gc.font = config.font;
    }
    if (gc.textAlign !== 'left') {
        gc.textAlign = 'left';
    }
    if (gc.textBaseline !== 'middle') {
        gc.textBaseline = 'middle';
    }

    if (halign === 'right') {
        //textWidth = config.getTextWidth(gc, config.value);
        halignOffset = width - cellPadding - textWidth;
    } else if (halign === 'center') {
        //textWidth = config.getTextWidth(gc, config.value);
        halignOffset = (width - textWidth) / 2;
    } else if (halign === 'left') {
        halignOffset = cellPadding;
    }

    halignOffset = Math.max(0, halignOffset);
    valignOffset = valignOffset + Math.ceil(height / 2);

    //fill background only if our backgroundColor is populated or we are a selected cell
    if (config.backgroundColor || config.isSelected) {
        gc.fillStyle = config.isSelected ? config.bgSelColor : config.backgroundColor;
        gc.fillRect(x, y, width, height);
    }

    //draw text
    var theColor = config.isSelected ? config.fgSelColor : config.color;
    if (gc.fillStyle !== theColor) {
        gc.fillStyle = theColor;
        gc.strokeStyle = theColor;
    }
    if (value !== null) {
        gc.fillText(value, x + halignOffset, y + valignOffset);
    }
}

module.exports = paint;
},{}],7:[function(require,module,exports){
'use strict';

var randomRow = function() {
    var row = {
        work: '',
        bids: (Math.random() * 100).toFixed(0),
        price: (Math.random() * 1000).toFixed(2),
        asks: (Math.random() * 100).toFixed(0),
        ltq: (Math.random() * 1000).toFixed(0)
    };
    return row;
};

var generateRandomData = function(rowCount) {
    var data = new Array(rowCount);
    for (var i = 0; i < rowCount; i++) {
        data[i] = randomRow();
    }
    return data;
};

module.exports = generateRandomData;
},{}],8:[function(require,module,exports){
var gridEvents = new GridEvents();

module.exports.gridEvents = gridEvents;


document.addEventListener('mousemove', function(e) {
    var gemm = gridEvents.mousemove;

    e.x = e.x || e.clientX;
    e.y = e.y || e.clientY;

    gemm.notify.bind(gemm)(e, gridEvents);
});


document.addEventListener('mousedown', function(e) {
    var gemd = gridEvents.mousedown;

    e.x = e.x || e.clientX;
    e.y = e.y || e.clientY;

    gemd.notify.bind(gemd)(e, gridEvents);
});


document.addEventListener('mouseup', function(e) {
    var gemu = gridEvents.mouseup;

    e.x = e.x || e.clientX;
    e.y = e.y || e.clientY;

    gemu.notify.bind(gemu)(e, gridEvents);
});


function SimpleObservable() {
    this.observers  = [];
};


SimpleObservable.prototype.addObserver = function(callback){
    this.observers.push(callback);
};

SimpleObservable.prototype.removeObserver = function(callback){
    var callbackIndex = this.observers.indexOf(callback);

    if (callbackIndex !== -1) {
        this.observers.splice(callbackIndex, 1);
    }
};

SimpleObservable.prototype.notify = function() {
    var i = 0,
        len = this.observers.length;

    for (; i < len; i++) {
        this.observers[i].apply(this, Array.prototype.slice.call(arguments));
    }

};


function GridEvents() {
    // generic DOM events
    this.mouseup = Object.create(new SimpleObservable());
    this.mousedown = Object.create(new SimpleObservable());
    this.mousemove = Object.create(new SimpleObservable());
};
},{}],9:[function(require,module,exports){
'use strict';

var Column = require('./column.js');
var SimpleLRU = require('simple-lru');
var defaultcellrenderer = require('./defaultcellrenderer.js');
var resizables = [];
var resizeLoopRunning = true;
var fontData = {};
var textWidthCache = new SimpleLRU(10000);


var resizablesLoopFunction = function(now) {
    if (!resizeLoopRunning) {
        return;
    }
    for (var i = 0; i < resizables.length; i++) {
        try {
            resizables[i](now);
        } catch (e) {}
    }
};
setInterval(resizablesLoopFunction, 200);


function Grid(domElement, model, properties) {

    var self = this;

    var options = this.getDefaultProperties();
    this.addProperties(properties);

    var canvas = document.createElement('canvas');
    var headerCanvas = document.createElement('canvas');
    var context = canvas.getContext("2d");
    var headerContext = headerCanvas.getContext("2d");
    var columns = [];

    model.changed = function(x, y) {
        self.paint(x, y);
    };

    this.getCanvas = function() {
        return canvas;
    };

    this.getHeaderCanvas = function() {
        return headerCanvas;
    };

    this.getContainer = function() {
        return domElement;
    };

    this.getContext = function() {
        return context;
    };

    this.getHeaderContext = function() {
        return headerContext;
    };

    this.getModel = function() {
        return model;
    };

    this.setModel = function(gridModel) {
        model = gridModel;
    };

    this.getColumns = function() {
        return columns;
    }

    this.setColumns = function (cols) {
        columns = cols;
    }

    this.getOptions = function() {
        return options;
    };

    this.setOptions = function(newOptions) {
        options = newOptions;
    };

    this.initialize()
};

Grid.prototype.getDefaultProperties = function() {
    return {
        font: '13px Tahoma, Geneva, sans-serif',
        color: '#ffffff',
        backgroundColor: '#505050',
        foregroundSelColor: 'rgb(25, 25, 25)',
        backgroundSelColor: 'rgb(183, 219, 255)',

        topLeftFont: '14px Tahoma, Geneva, sans-serif',
        topLeftColor: 'rgb(25, 25, 25)',
        topLeftBackgroundColor: 'rgb(223, 227, 232)',
        topLeftFGSelColor: 'rgb(25, 25, 25)',
        topLeftBGSelColor: 'rgb(255, 220, 97)',

        fixedColumnFont: '14px Tahoma, Geneva, sans-serif',
        fixedColumnColor: 'rgb(25, 25, 25)',
        fixedColumnBackgroundColor: 'rgb(223, 227, 232)',
        fixedColumnFGSelColor: 'rgb(25, 25, 25)',
        fixedColumnBGSelColor: 'rgb(255, 220, 97)',

        fixedRowFont: '11px Tahoma, Geneva, sans-serif',
        fixedRowColor: '#ffffff',
        fixedRowBackgroundColor: '#303030',
        fixedRowFGSelColor: 'rgb(25, 25, 25)',
        fixedRowBGSelColor: 'rgb(255, 220, 97)',

        backgroundColor2: '#303030',
        lineColor: '#707070',
        voffset: 0,
        scrollingEnabled: false,

        defaultRowHeight: 25,
        defaultFixedRowHeight: 20,
        defaultColumnWidth: 100,
        defaultFixedColumnWidth: 100,
        cellPadding: 5
    };
};

Grid.prototype.getTextWidth = function(gc, string) {
    if (string === null || string === undefined) {
        return 0;
    }
    string = string + '';
    if (string.length === 0) {
        return 0;
    }
    var key = gc.font + string;
    var width = textWidthCache.get(key);
    if (!width) {
        width = gc.measureText(string).width;
        textWidthCache.set(key, width);
    }
    return width;
};


Grid.prototype.getTextHeight = function(font) {

    var result = fontData[font];
    if (result) {
        return result;
    }
    result = {};
    var text = document.createElement('span');
    text.textContent = 'Hg';
    text.style.font = font;

    var block = document.createElement('div');
    block.style.display = 'inline-block';
    block.style.width = '1px';
    block.style.height = '0px';

    var div = document.createElement('div');
    div.appendChild(text);
    div.appendChild(block);

    div.style.position = 'absolute';
    document.body.appendChild(div);

    try {

        block.style.verticalAlign = 'baseline';

        var blockRect = block.getBoundingClientRect();
        var textRect = text.getBoundingClientRect();

        result.ascent = blockRect.top - textRect.top;

        block.style.verticalAlign = 'bottom';
        result.height = blockRect.top - textRect.top;

        result.descent = result.height - result.ascent;

    } finally {
        document.body.removeChild(div);
    }
    if (result.height !== 0) {
        fontData[font] = result;
    }
    return result;
};

Grid.prototype.merge = function(properties1, properties2) {
    for (var key in properties2) {
        if (properties2.hasOwnProperty(key)) {
            properties1[key] = properties2[key];
        }
    }
};

Grid.prototype.addProperties = function(properties) {
    this.merge(this.options, properties);
};

Grid.prototype.initialize = function() {
    var self = this;
    var fixedRowHeight = this.getFixedRowHeight();
    var container = this.getContainer();
    var divHeader = document.createElement('div');
    divHeader.style.position = 'absolute';
    divHeader.style.top = 0;
    divHeader.style.right = 0;
    divHeader.style.left = 0;
    divHeader.style.overflow = 'hidden';

    divHeader.appendChild(this.getHeaderCanvas());
    container.appendChild(divHeader);

    require('./col-reorder.js').init(self, divHeader);

    var divMain = document.createElement('div');
    divMain.style.position = 'absolute';
    divMain.style.top = fixedRowHeight + 'px';
    divMain.style.right = 0;
    divMain.style.bottom = 0;
    divMain.style.left = 0;
    divMain.style.overflow = 'auto';
    divMain.style.msOverflowStyle = '-ms-autohiding-scrollbar';
    divMain.addEventListener("scroll", function(e) {
        divHeader.scrollLeft = e.target.scrollLeft;
    });



    divMain.appendChild(this.getCanvas());
    container.appendChild(divMain);

    this.checkCanvasBounds();
    this.beginResizing();
};

Grid.prototype.checkCanvasBounds = function() {
    var container = this.getContainer();
    var headerHeight = this.getFixedRowHeight();
    var computedWidth = this.computeMainAreaFullWidth();
    var computedHeight = this.computeMainAreaFullHeight() - headerHeight;

    if (this.width === computedWidth && this.height === computedHeight) {
        return;
    }

    this.viewport = container.getBoundingClientRect();

    var headerCanvas = this.getHeaderCanvas();
    var canvas = this.getCanvas();

    headerCanvas.style.position = 'relative';
    headerCanvas.setAttribute('width', computedWidth);
    headerCanvas.setAttribute('height', headerHeight);

    canvas.style.position = 'relative';
    canvas.style.top = '1px';
    canvas.setAttribute('width', computedWidth);
    canvas.setAttribute('height', computedHeight);

    this.width = computedWidth;
    this.height = computedHeight;

    this.paintAll();
};


Grid.prototype.getViewportVisibleGridCoordinates = function() {
	//this is an important optimization
};

Grid.prototype.computeMainAreaFullHeight = function() {
    var rowHeight = this.getRowHeight(0);
    var numRows = this.getRowCount();
    var totalHeight = rowHeight * numRows;
    return totalHeight;
};

Grid.prototype.computeMainAreaFullWidth = function() {
    var numCols = this.getColumnCount();
    var width = 0;
    for (var i = 0; i < numCols; i++) {
        width = width + this.getColumnWidth(i);
    }
    return width;
};

Grid.prototype.stopResizeThread = function() {
    resizeLoopRunning = false;
};

Grid.prototype.restartResizeThread = function() {
    if (resizeLoopRunning) {
        return; // already running
    }
    resizeLoopRunning = true;
    setInterval(resizablesLoopFunction, 200);
};

Grid.prototype.beginResizing = function() {
    var self = this;
    this.tickResizer = function() {
        self.checkCanvasBounds();
    };
    resizables.push(this.tickResizer);
};

Grid.prototype.stopResizing = function() {
    resizables.splice(resizables.indexOf(this.tickResizer), 1);
};

Grid.prototype.getColumn = function(x) {
    var column = this.getColumns()[x];
    return column;
};

Grid.prototype.getValue = function(x, y) {
    var model = this.getModel();
    var column = this.getColumns()[x];
    var field = column.getField();
    var value = model.getValue(field, y);
    return value;
};

Grid.prototype.getBoundsOfCell = function(x, y) {
    var rx, ry, rwidth, rheight;
    var rowHeight = this.getRowHeight(0);

    rx = 0;
    for (var i = 0; i < x; i++) {
        rx = rx + this.getColumnWidth(i);
    }
    ry = rowHeight * y;
    rwidth = this.getColumnWidth(x);
    rheight = rowHeight;
    var result = {
        x: rx,
        y: ry,
        width: rwidth,
        height: rheight
    };
    return result;
};

Grid.prototype.getFixedRowHeight = function() {
    var value = this.resolveProperty('defaultFixedRowHeight');
    return value;
};

Grid.prototype.getColumnWidth = function(x) {
    var column = this.getColumn(x);
    var value = column.getWidth();
    return value;
};

Grid.prototype.getRowHeight = function(y) {
    var value = this.resolveProperty('defaultRowHeight');
    return value;
};

Grid.prototype.resolveProperty = function(name) {
    var value = this.getOptions()[name];
    return value;
};

Grid.prototype.getColumnCount = function() {
    var columns = this.getColumns();
    return columns.length
};

Grid.prototype.getRowCount = function() {
    var model = this.getModel();
    return model.getRowCount();
};

Grid.prototype.addColumn = function(field, label, type, width, renderer) {
    var columns = this.getColumns();
    var newCol = new Column(this, field, label, type, width, renderer);
    columns.push(newCol);
};

Grid.prototype.paintAll = function() {
	var self = this;
	var config = Object.create(this.getDefaultProperties());

	config.getTextHeight = function(font) {
		return self.getTextHeight(font);
	};

	config.getTextWidth = function(gc, text) {
		return self.getTextWidth(gc, text);
	};


    var numCols = this.getColumnCount();
    var numRows = this.getRowCount();
	this.paintMainArea(config, numCols, numRows);
	this.paintHeaders(config, numCols, 1);
}

Grid.prototype.paintMainArea = function(config, numCols, numRows) {
    try {
        var self = this;
        var context = this.getContext();
        context.save();
        for (var x = 0; x < numCols; x++) {
            for (var y = 0; y < numRows; y++) {
                this.paintCell(context, x, y, config);
            }
        }

    } catch (e) {
        context.restore();
        console.log(e);
    }
};


Grid.prototype.paintHeaders = function(config, numCols, numRows) {
    try {
    	config.halign = 'center';
    	config.cellPadding = '0px';
        var self = this;
        var context = this.getHeaderContext();
        context.save();
        for (var x = 0; x < numCols; x++) {
            for (var y = 0; y < numRows; y++) {
                this.paintHeaderCell(context, x, y, config);
            }
        }

    } catch (e) {
        context.restore();
        console.log(e);
    }
};

Grid.prototype.paintCell = function(context, x, y, config) {
    var model = this.getModel();
    var bounds = this.getBoundsOfCell(x, y);
    var column = this.getColumn(x);
    var renderer = column.getRenderer();
    var value = this.getValue(x, y);
    config.value = value;
    config.x = x;
    config.y = y;
    config.bounds = bounds;
    renderer(context, config);
};


Grid.prototype.paintHeaderCell = function(context, x, y, config) {
    var bounds = this.getBoundsOfCell(x, y);
    var column = this.getColumn(x);
    var renderer = column.getRenderer();
    var value = column.getLabel();
    config.value = value;
    config.x = x;
    config.y = y;
    config.bounds = bounds;
    renderer(context, config);
};

Grid.prototype.getDefaultCellRenderer = function() {
    return defaultcellrenderer;
}

module.exports = function(domElement, model) {
    return new Grid(domElement, model);
};

},{"./col-reorder.js":4,"./column.js":5,"./defaultcellrenderer.js":6,"simple-lru":2}],10:[function(require,module,exports){
'use strict';


var GridModel = function(jsonData) {

    //this function should be overriden by grid itself;
    //if coordinates -1, -1 are used, it means 
    //repaint the whole visible grid
    this.changed = function(x, y) {};

    this.getData = function() {
        return jsonData;
    };

    this.setData = function(data) {
        jsonData = data;
    }

};

GridModel.prototype.getValue = function(field, y) {
    var obj = this.getData()[y];
    var value = obj[field];
    return value;
};

GridModel.prototype.getRowCount = function() {
    return this.getData().length;
};

module.exports = GridModel;
},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvamF2YXNjcmlwdC9tYWluLmpzIiwibm9kZV9tb2R1bGVzL3NpbXBsZS1scnUvc2ltcGxlLWxydS5qcyIsIm5vZGVfbW9kdWxlcy91bmRlcnNjb3JlL3VuZGVyc2NvcmUuanMiLCJzcmMvamF2YXNjcmlwdC9jb21wb25lbnRzL2NvbC1yZW9yZGVyLmpzIiwic3JjL2phdmFzY3JpcHQvY29tcG9uZW50cy9jb2x1bW4uanMiLCJzcmMvamF2YXNjcmlwdC9jb21wb25lbnRzL2RlZmF1bHRjZWxscmVuZGVyZXIuanMiLCJzcmMvamF2YXNjcmlwdC9jb21wb25lbnRzL2R1bW15ZGF0YS5qcyIsInNyYy9qYXZhc2NyaXB0L2NvbXBvbmVudHMvZXZlbnRzLmpzIiwic3JjL2phdmFzY3JpcHQvY29tcG9uZW50cy9ncmlkLmpzIiwic3JjL2phdmFzY3JpcHQvY29tcG9uZW50cy9ncmlkbW9kZWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVnREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25YQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMWRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBfID0gcmVxdWlyZSgndW5kZXJzY29yZScpO1xuXG52YXIgZ3JpZCA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9ncmlkLmpzJyk7XG52YXIgR3JpZE1vZGVsID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL2dyaWRtb2RlbC5qcycpO1xuXG53aW5kb3cucmFuZG9tRGF0YSA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9kdW1teWRhdGEuanMnKTtcblxuaWYgKCF3aW5kb3cuZmluKSB7XG4gICAgd2luZG93LmZpbiA9IHt9O1xuICAgIHdpbmRvdy5maW4uaHlwZXJncmlkbGl0ZSA9IHtcbiAgICAgICAgY3JlYXRlT246IGdyaWQsXG4gICAgICAgIEdyaWRNb2RlbDogR3JpZE1vZGVsXG4gICAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMuZm9vID0gJ2Zvbyc7IiwiOyhmdW5jdGlvbiAoKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICAvKipcbiAgICogZXhwb3J0IFNpbXBsZUxSVSBmb3IgQ29tbW9uSlMsIEFNRFxuICAgKi9cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBTaW1wbGVMUlU7XG4gICAgfSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFNpbXBsZUxSVTtcbiAgfSBlbHNlIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgIHdpbmRvdy5TaW1wbGVMUlUgPSBTaW1wbGVMUlU7XG4gIH1cblxuICBTaW1wbGVMUlUudmVyc2lvbiA9ICcwLjAuMyc7XG5cbiAgLyoqXG4gICAqIFNpbXBsZSBtaXhpbiB1dGlsaXR5XG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cbiAgZnVuY3Rpb24gZXh0ZW5kKG9iajEsIG9iajIpIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqMikgb2JqMVtrZXldID0gb2JqMltrZXldO1xuICB9XG5cbiAgdmFyIG5hdGl2ZUNyZWF0ZSA9IE9iamVjdC5jcmVhdGU7XG5cbiAgLyoqXG4gICAqIE9iamVjdCBkYXRhIHN0b3JlXG4gICAqIHRoaXMgaXMgYSBgT2JqZWN0LmNyZWF0ZWAgZmFsbGJhY2sgaW4gb3JkZXIgdG8gc3VwcG9ydCBJRThcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuICB2YXIgRGF0YSA9IChmdW5jdGlvbiAoKSB7XG4gICAgdmFyIERhdGEsIHByb3RvO1xuXG4gICAgaWYgKHR5cGVvZiBuYXRpdmVDcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIERhdGEgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IG5hdGl2ZUNyZWF0ZShudWxsKTtcbiAgICAgIH07XG5cbiAgICAgIHByb3RvID0ge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5kYXRhW2tleV07XG4gICAgICAgIH0sXG4gICAgICAgIGhhczogZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgIHJldHVybiAhISB0aGlzLmRhdGFba2V5XTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBEYXRhID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmRhdGEgPSB7fTtcbiAgICAgIH07XG5cbiAgICAgIHByb3RvID0ge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICBpZiAodGhpcy5oYXMoa2V5KSkgcmV0dXJuIHRoaXMuZGF0YVtrZXldO1xuICAgICAgICB9LFxuICAgICAgICBoYXM6IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMuZGF0YSwga2V5KTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBleHRlbmQocHJvdG8sIHtcbiAgICAgIHNldDogZnVuY3Rpb24gKGtleSwgdmFsKSB7XG4gICAgICAgIHRoaXMuZGF0YVtrZXldID0gdmFsO1xuICAgICAgfSxcbiAgICAgIGRlbDogZnVuY3Rpb24gKGtleSkge1xuICAgICAgICB2YXIgdmFsID0gdGhpcy5nZXQoa2V5KTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuZGF0YVtrZXldO1xuICAgICAgICAgIHJldHVybiB2YWw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4dGVuZChEYXRhLnByb3RvdHlwZSwgcHJvdG8pO1xuXG4gICAgcmV0dXJuIERhdGE7XG4gIH0pKCk7XG5cbiAgLyoqXG4gICAqIENhY2hlIGVudHJ5IGluc3RhbmNlXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfVxuICAgKiBAcGFyYW0ge2FueX1cbiAgICogQHBhcmFtIHtOdW1iZXJ9XG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cbiAgZnVuY3Rpb24gRW50cnkoa2V5LCB2YWwsIGluZGV4KSB7XG4gICAgdGhpcy5rZXkgPSBrZXk7XG4gICAgdGhpcy52YWwgPSB2YWw7XG4gICAgdGhpcy5pbmRleCA9IGluZGV4O1xuICB9XG5cbiAgLyoqXG4gICAqIFNpbXBsZUxSVSBjb25zdHJ1Y3RvclxuICAgKiBJdCBob2xkcyBmb2xsb3dpbmcgcHJpdmF0ZSBwcm9wZXJ0aWVzLiBTZWUgYCNyZXNldCgpYFxuICAgKlxuICAgKiAgIF9ieUtleSAgICB7RGF0YX0gICAgbWFwIGJ5IGtleVxuICAgKiAgIF9ieU9yZGVyICB7T2JqZWN0fSAgbWFwIGJ5IHJlY2VudGx5IHVzZWQgb3JkZXJcbiAgICogICBfaGVhZCAgICAge051bWJlcn0gIGluZGV4IG9mIG5leHQgZW50cnlcbiAgICogICBfdGFpbCAgICAge051bWJlcn0gIGluZGV4IG9mIGxlYXN0IHJlY2VudGx5IHVzZWQgY2FjaGUgaXRlbVxuICAgKiAgIF9sZW4gICAgICB7TnVtYmVyfSAgdG90YWwgbnVtYmVyIG9mIGNhY2hlIGl0ZW1zXG4gICAqXG4gICAqIGBfdGFpbGAgaXMgYW4gaW5kZXggb2YgdGhlIGxlYXN0IHJlY2VudGx5IHVzZWQgY2FjaGUgaXRlbS5cbiAgICogYF9oZWFkYCBpcyBhbiBpbmRleCBvZiB0aGUgbW9zdCByZWNlbnRseSB1c2VkIGNhY2hlIGl0ZW0gKnBsdXMqIG9uZS5cbiAgICpcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG1heCBsZW5ndGggb2YgY2FjaGUgaXRlbVxuICAgKi9cbiAgZnVuY3Rpb24gU2ltcGxlTFJVKG1heCkge1xuICAgIGlmICh0eXBlb2YgbWF4ICE9PSAnbnVtYmVyJykgdGhyb3cgbmV3IFR5cGVFcnJvcignbWF4IGlzIHJlcXVyaWVkJyk7XG4gICAgdGhpcy5tYXgobWF4KTtcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cblxuICBleHRlbmQoU2ltcGxlTFJVLnByb3RvdHlwZSwge1xuXG4gICAgLyoqXG4gICAgICogU2V0IGNhY2hlIGJ5IGtleVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB1bmlxdWUgc3RyaW5nIGtleVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfE9iamVjdHxOdW1iZXJ9IGFueSB2YWx1ZVxuICAgICAqL1xuICAgIHNldDogZnVuY3Rpb24gKGtleSwgdmFsKSB7XG4gICAgICB2YXIgZW50cnkgPSB0aGlzLl9ieUtleS5nZXQoa2V5KTtcblxuICAgICAgLy8gcmV1c2UgZW50cnkgaWYgdGhlIGtleSBleGlzdHNcbiAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICB0aGlzLl90b3VjaChlbnRyeSk7XG4gICAgICAgIGVudHJ5LnZhbCA9IHZhbDtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBlbnRyeSA9IG5ldyBFbnRyeShrZXksIHZhbCwgdGhpcy5faGVhZCsrKTtcbiAgICAgIHRoaXMuX2J5S2V5LnNldChrZXksIGVudHJ5KTtcbiAgICAgIHRoaXMuX2J5T3JkZXJbZW50cnkuaW5kZXhdID0gZW50cnk7XG4gICAgICB0aGlzLl9sZW4rKztcbiAgICAgIHRoaXMuX3RyaW0oKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogZGVsZXRlIGNhY2hlIGJ5IGtleVxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9XG4gICAgICogQHJldHVybiB7U3RyaW5nfE9iamVjdHxOdW1iZXJ9IGNhY2hlZCB2YWx1ZVxuICAgICAqL1xuICAgIGRlbDogZnVuY3Rpb24gKGtleSkge1xuICAgICAgdmFyIGVudHJ5ID0gdGhpcy5fYnlLZXkuZGVsKGtleSk7XG4gICAgICBpZiAoIWVudHJ5KSByZXR1cm47XG5cbiAgICAgIGRlbGV0ZSB0aGlzLl9ieU9yZGVyW2VudHJ5LmluZGV4XTtcbiAgICAgIHRoaXMuX2xlbi0tO1xuXG4gICAgICBpZiAodGhpcy5fbGVuID09PSAwKSB7XG4gICAgICAgIHRoaXMuX2hlYWQgPSB0aGlzLl90YWlsID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHVwZGF0ZSBtb3N0IGluZGV4IGlmIGl0IHdhcyBtb3N0IGxlY2VudGx5IHVzZWQgZW50cnlcbiAgICAgICAgaWYgKGVudHJ5LmluZGV4ID09PSB0aGlzLl9oZWFkIC0gMSkgdGhpcy5fcG9wKCk7XG4gICAgICAgIC8vIHVwZGF0ZSBsZWFzdCBpbmRleCBpZiBpdCB3YXMgbGVhc3QgbGVjZW50bHkgdXNlZCBlbnRyeVxuICAgICAgICBpZiAoZW50cnkuaW5kZXggPT09IHRoaXMuX3RhaWwpIHRoaXMuX3NoaWZ0KCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBlbnRyeS52YWw7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIGdldCBjYWNoZSBieSBrZXlcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfVxuICAgICAqIEByZXR1cm4ge2FueX0gY2FjaGUgaWYgaXQgZXhpc3RzXG4gICAgICovXG4gICAgZ2V0OiBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICB2YXIgZW50cnkgPSB0aGlzLl9ieUtleS5nZXQoa2V5KTtcbiAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICB0aGlzLl90b3VjaChlbnRyeSk7XG4gICAgICAgIHJldHVybiBlbnRyeS52YWw7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIGdldCBhIGNhY2hlIGJ5IGtleSB3aXRob3V0IHRvdWNoaW5nIGluZGV4XG4gICAgICogQHJldHVybiB7YW55fVxuICAgICAqL1xuICAgIHBlZWs6IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgIHZhciBlbnRyeSA9IHRoaXMuX2J5S2V5LmdldChrZXkpO1xuICAgICAgaWYgKGVudHJ5KSByZXR1cm4gZW50cnkudmFsO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBzZWUgaWYga2V5IGlzIGV4aXN0cyBvciBub3RcbiAgICAgKiBAcmV0dXJuIHtCb29sZWFufVxuICAgICAqL1xuICAgIGhhczogZnVuY3Rpb24gKGtleSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2J5S2V5LmhhcyhrZXkpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiB0b3RhbCBudW1iZXIgb2YgY2FjaGVcbiAgICAgKiBAcmV0dXJuIHtOdW1iZXJ9XG4gICAgICovXG4gICAgbGVuZ3RoOiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbGVuO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBjbGVhciBhbGwgc3RvcmVkIGNhY2hlXG4gICAgICovXG4gICAgcmVzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHRoaXMuX2J5S2V5ID0gbmV3IERhdGEoKTtcbiAgICAgIHRoaXMuX2J5T3JkZXIgPSBuYXRpdmVDcmVhdGUgPyBuYXRpdmVDcmVhdGUobnVsbCkgOiB7fTtcbiAgICAgIHRoaXMuX2hlYWQgPSAwO1xuICAgICAgdGhpcy5fdGFpbCA9IDA7XG4gICAgICB0aGlzLl9sZW4gPSAwO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXR0ZXJ8U2V0dGVyIGZ1bmN0aW9uIG9mIFwibWF4XCIgb3B0aW9uXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGlmIHNldHRlclxuICAgICAqL1xuICAgIG1heDogZnVuY3Rpb24gKG1heCkge1xuICAgICAgaWYgKHR5cGVvZiBtYXggIT09ICdudW1iZXInKSByZXR1cm4gdGhpcy5fbWF4O1xuICAgICAgaWYgKG1heCA8IDEpIHRocm93IG5ldyBUeXBlRXJyb3IoJ21heCBzaG91bGQgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgICAgIHZhciBzaHJpbmsgPSAodGhpcy5fbWF4IHx8IDApID4gbWF4O1xuICAgICAgdGhpcy5fbWF4ID0gbWF4O1xuICAgICAgaWYgKHNocmluaykgdGhpcy5fdHJpbSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiByZXR1cm4gYXJyYXkgb2Yga2V5cyBpbiBsZWFzdCByZWNlbnRseSB1c2VkIG9yZGVyXG4gICAgICogQHJldHVybiB7QXJyYXl9XG4gICAgICovXG4gICAga2V5czogZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGNvdW50ID0gMFxuICAgICAgICAsIHRhaWwgPSB0aGlzLl90YWlsXG4gICAgICAgICwgaGVhZCA9IHRoaXMuX2hlYWRcbiAgICAgICAgLCBrZXlzID0gbmV3IEFycmF5KHRoaXMuX2xlbik7XG5cbiAgICAgIGZvciAodmFyIGkgPSB0YWlsOyBpIDwgaGVhZDsgaSsrKSB7XG4gICAgICAgIHZhciBlbnRyeSA9IHRoaXMuX2J5T3JkZXJbaV07XG4gICAgICAgIGlmIChlbnRyeSkga2V5c1tjb3VudCsrXSA9IGVudHJ5LmtleTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGtleXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIHVwZGF0ZSBsZWFzdCByZWNlbnRseSB1c2VkIGluZGV4IG9mIGFuIGVudHJ5IHRvIFwiX2hlYWRcIlxuICAgICAqXG4gICAgICogQHBhcmFtIHtFbnRyeX1cbiAgICAgKiBAYXBpIHByaXZhdGVcbiAgICAgKi9cbiAgICBfdG91Y2g6IGZ1bmN0aW9uIChlbnRyeSkge1xuICAgICAgLy8gdXBkYXRlIG1vc3QgbnVtYmVyIHRvIGtleVxuICAgICAgaWYgKGVudHJ5LmluZGV4ICE9PSB0aGlzLl9oZWFkIC0gMSkge1xuICAgICAgICB2YXIgaXNUYWlsID0gZW50cnkuaW5kZXggPT09IHRoaXMuX3RhaWw7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9ieU9yZGVyW2VudHJ5LmluZGV4XTtcbiAgICAgICAgZW50cnkuaW5kZXggPSB0aGlzLl9oZWFkKys7XG4gICAgICAgIHRoaXMuX2J5T3JkZXJbZW50cnkuaW5kZXhdID0gZW50cnk7XG4gICAgICAgIGlmIChpc1RhaWwpIHRoaXMuX3NoaWZ0KCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIHRyaW0gZW50cmllc1xuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuICAgIF90cmltOiBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgbWF4ID0gdGhpcy5fbWF4O1xuICAgICAgd2hpbGUgKG1heCA8IHRoaXMuX2xlbikge1xuICAgICAgICB2YXIgdGFpbEVudHJ5ID0gdGhpcy5fYnlPcmRlclt0aGlzLl90YWlsXTtcbiAgICAgICAgdGhpcy5kZWwodGFpbEVudHJ5LmtleSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIHVwZGF0ZSB0YWlsIGluZGV4XG4gICAgICogQHJldHVybiB7RW50cnl8dW5kZWZpbmVkfVxuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zaGlmdDogZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIHRhaWwgPSB0aGlzLl90YWlsXG4gICAgICAgICwgaGVhZCA9IHRoaXMuX2hlYWQ7XG4gICAgICBmb3IgKHZhciBpID0gdGFpbDsgaSA8IGhlYWQ7IGkrKykge1xuICAgICAgICB2YXIgZW50cnkgPSB0aGlzLl9ieU9yZGVyW2ldO1xuICAgICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgICB0aGlzLl90YWlsID0gaTtcbiAgICAgICAgICByZXR1cm4gZW50cnk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogdXBkYXRlIGhlYWQgaW5kZXhcbiAgICAgKiBAcmV0dXJuIHtFbnRyeXx1bmRlZmluZWR9XG4gICAgICogQGFwaSBwcml2YXRlXG4gICAgICovXG4gICAgX3BvcDogZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIHRhaWwgPSB0aGlzLl90YWlsXG4gICAgICAgICwgaGVhZCA9IHRoaXMuX2hlYWQ7XG4gICAgICBmb3IgKHZhciBpID0gaGVhZCAtIDE7IGkgPj0gdGFpbDsgaS0tKSB7XG4gICAgICAgIHZhciBoZWFkRW50cnkgPSB0aGlzLl9ieU9yZGVyW2ldO1xuICAgICAgICBpZiAoaGVhZEVudHJ5KSB7XG4gICAgICAgICAgdGhpcy5faGVhZCA9IGkgKyAxO1xuICAgICAgICAgIHJldHVybiBoZWFkRW50cnk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG59KSgpOyIsIi8vICAgICBVbmRlcnNjb3JlLmpzIDEuOC4zXG4vLyAgICAgaHR0cDovL3VuZGVyc2NvcmVqcy5vcmdcbi8vICAgICAoYykgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4vLyAgICAgVW5kZXJzY29yZSBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblxuKGZ1bmN0aW9uKCkge1xuXG4gIC8vIEJhc2VsaW5lIHNldHVwXG4gIC8vIC0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gRXN0YWJsaXNoIHRoZSByb290IG9iamVjdCwgYHdpbmRvd2AgaW4gdGhlIGJyb3dzZXIsIG9yIGBleHBvcnRzYCBvbiB0aGUgc2VydmVyLlxuICB2YXIgcm9vdCA9IHRoaXM7XG5cbiAgLy8gU2F2ZSB0aGUgcHJldmlvdXMgdmFsdWUgb2YgdGhlIGBfYCB2YXJpYWJsZS5cbiAgdmFyIHByZXZpb3VzVW5kZXJzY29yZSA9IHJvb3QuXztcblxuICAvLyBTYXZlIGJ5dGVzIGluIHRoZSBtaW5pZmllZCAoYnV0IG5vdCBnemlwcGVkKSB2ZXJzaW9uOlxuICB2YXIgQXJyYXlQcm90byA9IEFycmF5LnByb3RvdHlwZSwgT2JqUHJvdG8gPSBPYmplY3QucHJvdG90eXBlLCBGdW5jUHJvdG8gPSBGdW5jdGlvbi5wcm90b3R5cGU7XG5cbiAgLy8gQ3JlYXRlIHF1aWNrIHJlZmVyZW5jZSB2YXJpYWJsZXMgZm9yIHNwZWVkIGFjY2VzcyB0byBjb3JlIHByb3RvdHlwZXMuXG4gIHZhclxuICAgIHB1c2ggICAgICAgICAgICAgPSBBcnJheVByb3RvLnB1c2gsXG4gICAgc2xpY2UgICAgICAgICAgICA9IEFycmF5UHJvdG8uc2xpY2UsXG4gICAgdG9TdHJpbmcgICAgICAgICA9IE9ialByb3RvLnRvU3RyaW5nLFxuICAgIGhhc093blByb3BlcnR5ICAgPSBPYmpQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuICAvLyBBbGwgKipFQ01BU2NyaXB0IDUqKiBuYXRpdmUgZnVuY3Rpb24gaW1wbGVtZW50YXRpb25zIHRoYXQgd2UgaG9wZSB0byB1c2VcbiAgLy8gYXJlIGRlY2xhcmVkIGhlcmUuXG4gIHZhclxuICAgIG5hdGl2ZUlzQXJyYXkgICAgICA9IEFycmF5LmlzQXJyYXksXG4gICAgbmF0aXZlS2V5cyAgICAgICAgID0gT2JqZWN0LmtleXMsXG4gICAgbmF0aXZlQmluZCAgICAgICAgID0gRnVuY1Byb3RvLmJpbmQsXG4gICAgbmF0aXZlQ3JlYXRlICAgICAgID0gT2JqZWN0LmNyZWF0ZTtcblxuICAvLyBOYWtlZCBmdW5jdGlvbiByZWZlcmVuY2UgZm9yIHN1cnJvZ2F0ZS1wcm90b3R5cGUtc3dhcHBpbmcuXG4gIHZhciBDdG9yID0gZnVuY3Rpb24oKXt9O1xuXG4gIC8vIENyZWF0ZSBhIHNhZmUgcmVmZXJlbmNlIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdCBmb3IgdXNlIGJlbG93LlxuICB2YXIgXyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogaW5zdGFuY2VvZiBfKSByZXR1cm4gb2JqO1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBfKSkgcmV0dXJuIG5ldyBfKG9iaik7XG4gICAgdGhpcy5fd3JhcHBlZCA9IG9iajtcbiAgfTtcblxuICAvLyBFeHBvcnQgdGhlIFVuZGVyc2NvcmUgb2JqZWN0IGZvciAqKk5vZGUuanMqKiwgd2l0aFxuICAvLyBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIGluXG4gIC8vIHRoZSBicm93c2VyLCBhZGQgYF9gIGFzIGEgZ2xvYmFsIG9iamVjdC5cbiAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gXztcbiAgICB9XG4gICAgZXhwb3J0cy5fID0gXztcbiAgfSBlbHNlIHtcbiAgICByb290Ll8gPSBfO1xuICB9XG5cbiAgLy8gQ3VycmVudCB2ZXJzaW9uLlxuICBfLlZFUlNJT04gPSAnMS44LjMnO1xuXG4gIC8vIEludGVybmFsIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhbiBlZmZpY2llbnQgKGZvciBjdXJyZW50IGVuZ2luZXMpIHZlcnNpb25cbiAgLy8gb2YgdGhlIHBhc3NlZC1pbiBjYWxsYmFjaywgdG8gYmUgcmVwZWF0ZWRseSBhcHBsaWVkIGluIG90aGVyIFVuZGVyc2NvcmVcbiAgLy8gZnVuY3Rpb25zLlxuICB2YXIgb3B0aW1pemVDYiA9IGZ1bmN0aW9uKGZ1bmMsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgaWYgKGNvbnRleHQgPT09IHZvaWQgMCkgcmV0dXJuIGZ1bmM7XG4gICAgc3dpdGNoIChhcmdDb3VudCA9PSBudWxsID8gMyA6IGFyZ0NvdW50KSB7XG4gICAgICBjYXNlIDE6IHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlKTtcbiAgICAgIH07XG4gICAgICBjYXNlIDI6IHJldHVybiBmdW5jdGlvbih2YWx1ZSwgb3RoZXIpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSwgb3RoZXIpO1xuICAgICAgfTtcbiAgICAgIGNhc2UgMzogcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICB9O1xuICAgICAgY2FzZSA0OiByZXR1cm4gZnVuY3Rpb24oYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIEEgbW9zdGx5LWludGVybmFsIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIGNhbGxiYWNrcyB0aGF0IGNhbiBiZSBhcHBsaWVkXG4gIC8vIHRvIGVhY2ggZWxlbWVudCBpbiBhIGNvbGxlY3Rpb24sIHJldHVybmluZyB0aGUgZGVzaXJlZCByZXN1bHQg4oCUIGVpdGhlclxuICAvLyBpZGVudGl0eSwgYW4gYXJiaXRyYXJ5IGNhbGxiYWNrLCBhIHByb3BlcnR5IG1hdGNoZXIsIG9yIGEgcHJvcGVydHkgYWNjZXNzb3IuXG4gIHZhciBjYiA9IGZ1bmN0aW9uKHZhbHVlLCBjb250ZXh0LCBhcmdDb3VudCkge1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKSByZXR1cm4gXy5pZGVudGl0eTtcbiAgICBpZiAoXy5pc0Z1bmN0aW9uKHZhbHVlKSkgcmV0dXJuIG9wdGltaXplQ2IodmFsdWUsIGNvbnRleHQsIGFyZ0NvdW50KTtcbiAgICBpZiAoXy5pc09iamVjdCh2YWx1ZSkpIHJldHVybiBfLm1hdGNoZXIodmFsdWUpO1xuICAgIHJldHVybiBfLnByb3BlcnR5KHZhbHVlKTtcbiAgfTtcbiAgXy5pdGVyYXRlZSA9IGZ1bmN0aW9uKHZhbHVlLCBjb250ZXh0KSB7XG4gICAgcmV0dXJuIGNiKHZhbHVlLCBjb250ZXh0LCBJbmZpbml0eSk7XG4gIH07XG5cbiAgLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIGFzc2lnbmVyIGZ1bmN0aW9ucy5cbiAgdmFyIGNyZWF0ZUFzc2lnbmVyID0gZnVuY3Rpb24oa2V5c0Z1bmMsIHVuZGVmaW5lZE9ubHkpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgIGlmIChsZW5ndGggPCAyIHx8IG9iaiA9PSBudWxsKSByZXR1cm4gb2JqO1xuICAgICAgZm9yICh2YXIgaW5kZXggPSAxOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICB2YXIgc291cmNlID0gYXJndW1lbnRzW2luZGV4XSxcbiAgICAgICAgICAgIGtleXMgPSBrZXlzRnVuYyhzb3VyY2UpLFxuICAgICAgICAgICAgbCA9IGtleXMubGVuZ3RoO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgICAgICAgIGlmICghdW5kZWZpbmVkT25seSB8fCBvYmpba2V5XSA9PT0gdm9pZCAwKSBvYmpba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH07XG4gIH07XG5cbiAgLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIGEgbmV3IG9iamVjdCB0aGF0IGluaGVyaXRzIGZyb20gYW5vdGhlci5cbiAgdmFyIGJhc2VDcmVhdGUgPSBmdW5jdGlvbihwcm90b3R5cGUpIHtcbiAgICBpZiAoIV8uaXNPYmplY3QocHJvdG90eXBlKSkgcmV0dXJuIHt9O1xuICAgIGlmIChuYXRpdmVDcmVhdGUpIHJldHVybiBuYXRpdmVDcmVhdGUocHJvdG90eXBlKTtcbiAgICBDdG9yLnByb3RvdHlwZSA9IHByb3RvdHlwZTtcbiAgICB2YXIgcmVzdWx0ID0gbmV3IEN0b3I7XG4gICAgQ3Rvci5wcm90b3R5cGUgPSBudWxsO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgdmFyIHByb3BlcnR5ID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIG9iaiA9PSBudWxsID8gdm9pZCAwIDogb2JqW2tleV07XG4gICAgfTtcbiAgfTtcblxuICAvLyBIZWxwZXIgZm9yIGNvbGxlY3Rpb24gbWV0aG9kcyB0byBkZXRlcm1pbmUgd2hldGhlciBhIGNvbGxlY3Rpb25cbiAgLy8gc2hvdWxkIGJlIGl0ZXJhdGVkIGFzIGFuIGFycmF5IG9yIGFzIGFuIG9iamVjdFxuICAvLyBSZWxhdGVkOiBodHRwOi8vcGVvcGxlLm1vemlsbGEub3JnL35qb3JlbmRvcmZmL2VzNi1kcmFmdC5odG1sI3NlYy10b2xlbmd0aFxuICAvLyBBdm9pZHMgYSB2ZXJ5IG5hc3R5IGlPUyA4IEpJVCBidWcgb24gQVJNLTY0LiAjMjA5NFxuICB2YXIgTUFYX0FSUkFZX0lOREVYID0gTWF0aC5wb3coMiwgNTMpIC0gMTtcbiAgdmFyIGdldExlbmd0aCA9IHByb3BlcnR5KCdsZW5ndGgnKTtcbiAgdmFyIGlzQXJyYXlMaWtlID0gZnVuY3Rpb24oY29sbGVjdGlvbikge1xuICAgIHZhciBsZW5ndGggPSBnZXRMZW5ndGgoY29sbGVjdGlvbik7XG4gICAgcmV0dXJuIHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicgJiYgbGVuZ3RoID49IDAgJiYgbGVuZ3RoIDw9IE1BWF9BUlJBWV9JTkRFWDtcbiAgfTtcblxuICAvLyBDb2xsZWN0aW9uIEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFRoZSBjb3JuZXJzdG9uZSwgYW4gYGVhY2hgIGltcGxlbWVudGF0aW9uLCBha2EgYGZvckVhY2hgLlxuICAvLyBIYW5kbGVzIHJhdyBvYmplY3RzIGluIGFkZGl0aW9uIHRvIGFycmF5LWxpa2VzLiBUcmVhdHMgYWxsXG4gIC8vIHNwYXJzZSBhcnJheS1saWtlcyBhcyBpZiB0aGV5IHdlcmUgZGVuc2UuXG4gIF8uZWFjaCA9IF8uZm9yRWFjaCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRlZSA9IG9wdGltaXplQ2IoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgIHZhciBpLCBsZW5ndGg7XG4gICAgaWYgKGlzQXJyYXlMaWtlKG9iaikpIHtcbiAgICAgIGZvciAoaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBpdGVyYXRlZShvYmpbaV0sIGksIG9iaik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgICBmb3IgKGkgPSAwLCBsZW5ndGggPSBrZXlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGl0ZXJhdGVlKG9ialtrZXlzW2ldXSwga2V5c1tpXSwgb2JqKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIHJlc3VsdHMgb2YgYXBwbHlpbmcgdGhlIGl0ZXJhdGVlIHRvIGVhY2ggZWxlbWVudC5cbiAgXy5tYXAgPSBfLmNvbGxlY3QgPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0ZWUgPSBjYihpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgdmFyIGtleXMgPSAhaXNBcnJheUxpa2Uob2JqKSAmJiBfLmtleXMob2JqKSxcbiAgICAgICAgbGVuZ3RoID0gKGtleXMgfHwgb2JqKS5sZW5ndGgsXG4gICAgICAgIHJlc3VsdHMgPSBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIHZhciBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICByZXN1bHRzW2luZGV4XSA9IGl0ZXJhdGVlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgLy8gQ3JlYXRlIGEgcmVkdWNpbmcgZnVuY3Rpb24gaXRlcmF0aW5nIGxlZnQgb3IgcmlnaHQuXG4gIGZ1bmN0aW9uIGNyZWF0ZVJlZHVjZShkaXIpIHtcbiAgICAvLyBPcHRpbWl6ZWQgaXRlcmF0b3IgZnVuY3Rpb24gYXMgdXNpbmcgYXJndW1lbnRzLmxlbmd0aFxuICAgIC8vIGluIHRoZSBtYWluIGZ1bmN0aW9uIHdpbGwgZGVvcHRpbWl6ZSB0aGUsIHNlZSAjMTk5MS5cbiAgICBmdW5jdGlvbiBpdGVyYXRvcihvYmosIGl0ZXJhdGVlLCBtZW1vLCBrZXlzLCBpbmRleCwgbGVuZ3RoKSB7XG4gICAgICBmb3IgKDsgaW5kZXggPj0gMCAmJiBpbmRleCA8IGxlbmd0aDsgaW5kZXggKz0gZGlyKSB7XG4gICAgICAgIHZhciBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICAgIG1lbW8gPSBpdGVyYXRlZShtZW1vLCBvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWVtbztcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgbWVtbywgY29udGV4dCkge1xuICAgICAgaXRlcmF0ZWUgPSBvcHRpbWl6ZUNiKGl0ZXJhdGVlLCBjb250ZXh0LCA0KTtcbiAgICAgIHZhciBrZXlzID0gIWlzQXJyYXlMaWtlKG9iaikgJiYgXy5rZXlzKG9iaiksXG4gICAgICAgICAgbGVuZ3RoID0gKGtleXMgfHwgb2JqKS5sZW5ndGgsXG4gICAgICAgICAgaW5kZXggPSBkaXIgPiAwID8gMCA6IGxlbmd0aCAtIDE7XG4gICAgICAvLyBEZXRlcm1pbmUgdGhlIGluaXRpYWwgdmFsdWUgaWYgbm9uZSBpcyBwcm92aWRlZC5cbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICBtZW1vID0gb2JqW2tleXMgPyBrZXlzW2luZGV4XSA6IGluZGV4XTtcbiAgICAgICAgaW5kZXggKz0gZGlyO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGl0ZXJhdG9yKG9iaiwgaXRlcmF0ZWUsIG1lbW8sIGtleXMsIGluZGV4LCBsZW5ndGgpO1xuICAgIH07XG4gIH1cblxuICAvLyAqKlJlZHVjZSoqIGJ1aWxkcyB1cCBhIHNpbmdsZSByZXN1bHQgZnJvbSBhIGxpc3Qgb2YgdmFsdWVzLCBha2EgYGluamVjdGAsXG4gIC8vIG9yIGBmb2xkbGAuXG4gIF8ucmVkdWNlID0gXy5mb2xkbCA9IF8uaW5qZWN0ID0gY3JlYXRlUmVkdWNlKDEpO1xuXG4gIC8vIFRoZSByaWdodC1hc3NvY2lhdGl2ZSB2ZXJzaW9uIG9mIHJlZHVjZSwgYWxzbyBrbm93biBhcyBgZm9sZHJgLlxuICBfLnJlZHVjZVJpZ2h0ID0gXy5mb2xkciA9IGNyZWF0ZVJlZHVjZSgtMSk7XG5cbiAgLy8gUmV0dXJuIHRoZSBmaXJzdCB2YWx1ZSB3aGljaCBwYXNzZXMgYSB0cnV0aCB0ZXN0LiBBbGlhc2VkIGFzIGBkZXRlY3RgLlxuICBfLmZpbmQgPSBfLmRldGVjdCA9IGZ1bmN0aW9uKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgdmFyIGtleTtcbiAgICBpZiAoaXNBcnJheUxpa2Uob2JqKSkge1xuICAgICAga2V5ID0gXy5maW5kSW5kZXgob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBrZXkgPSBfLmZpbmRLZXkob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIH1cbiAgICBpZiAoa2V5ICE9PSB2b2lkIDAgJiYga2V5ICE9PSAtMSkgcmV0dXJuIG9ialtrZXldO1xuICB9O1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIHRoYXQgcGFzcyBhIHRydXRoIHRlc3QuXG4gIC8vIEFsaWFzZWQgYXMgYHNlbGVjdGAuXG4gIF8uZmlsdGVyID0gXy5zZWxlY3QgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgcHJlZGljYXRlID0gY2IocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICBfLmVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChwcmVkaWNhdGUodmFsdWUsIGluZGV4LCBsaXN0KSkgcmVzdWx0cy5wdXNoKHZhbHVlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfTtcblxuICAvLyBSZXR1cm4gYWxsIHRoZSBlbGVtZW50cyBmb3Igd2hpY2ggYSB0cnV0aCB0ZXN0IGZhaWxzLlxuICBfLnJlamVjdCA9IGZ1bmN0aW9uKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgcmV0dXJuIF8uZmlsdGVyKG9iaiwgXy5uZWdhdGUoY2IocHJlZGljYXRlKSksIGNvbnRleHQpO1xuICB9O1xuXG4gIC8vIERldGVybWluZSB3aGV0aGVyIGFsbCBvZiB0aGUgZWxlbWVudHMgbWF0Y2ggYSB0cnV0aCB0ZXN0LlxuICAvLyBBbGlhc2VkIGFzIGBhbGxgLlxuICBfLmV2ZXJ5ID0gXy5hbGwgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHByZWRpY2F0ZSA9IGNiKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgdmFyIGtleXMgPSAhaXNBcnJheUxpa2Uob2JqKSAmJiBfLmtleXMob2JqKSxcbiAgICAgICAgbGVuZ3RoID0gKGtleXMgfHwgb2JqKS5sZW5ndGg7XG4gICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgdmFyIGN1cnJlbnRLZXkgPSBrZXlzID8ga2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIGlmICghcHJlZGljYXRlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgaWYgYXQgbGVhc3Qgb25lIGVsZW1lbnQgaW4gdGhlIG9iamVjdCBtYXRjaGVzIGEgdHJ1dGggdGVzdC5cbiAgLy8gQWxpYXNlZCBhcyBgYW55YC5cbiAgXy5zb21lID0gXy5hbnkgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHByZWRpY2F0ZSA9IGNiKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgdmFyIGtleXMgPSAhaXNBcnJheUxpa2Uob2JqKSAmJiBfLmtleXMob2JqKSxcbiAgICAgICAgbGVuZ3RoID0gKGtleXMgfHwgb2JqKS5sZW5ndGg7XG4gICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgdmFyIGN1cnJlbnRLZXkgPSBrZXlzID8ga2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIGlmIChwcmVkaWNhdGUob2JqW2N1cnJlbnRLZXldLCBjdXJyZW50S2V5LCBvYmopKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xuXG4gIC8vIERldGVybWluZSBpZiB0aGUgYXJyYXkgb3Igb2JqZWN0IGNvbnRhaW5zIGEgZ2l2ZW4gaXRlbSAodXNpbmcgYD09PWApLlxuICAvLyBBbGlhc2VkIGFzIGBpbmNsdWRlc2AgYW5kIGBpbmNsdWRlYC5cbiAgXy5jb250YWlucyA9IF8uaW5jbHVkZXMgPSBfLmluY2x1ZGUgPSBmdW5jdGlvbihvYmosIGl0ZW0sIGZyb21JbmRleCwgZ3VhcmQpIHtcbiAgICBpZiAoIWlzQXJyYXlMaWtlKG9iaikpIG9iaiA9IF8udmFsdWVzKG9iaik7XG4gICAgaWYgKHR5cGVvZiBmcm9tSW5kZXggIT0gJ251bWJlcicgfHwgZ3VhcmQpIGZyb21JbmRleCA9IDA7XG4gICAgcmV0dXJuIF8uaW5kZXhPZihvYmosIGl0ZW0sIGZyb21JbmRleCkgPj0gMDtcbiAgfTtcblxuICAvLyBJbnZva2UgYSBtZXRob2QgKHdpdGggYXJndW1lbnRzKSBvbiBldmVyeSBpdGVtIGluIGEgY29sbGVjdGlvbi5cbiAgXy5pbnZva2UgPSBmdW5jdGlvbihvYmosIG1ldGhvZCkge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHZhciBpc0Z1bmMgPSBfLmlzRnVuY3Rpb24obWV0aG9kKTtcbiAgICByZXR1cm4gXy5tYXAob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgdmFyIGZ1bmMgPSBpc0Z1bmMgPyBtZXRob2QgOiB2YWx1ZVttZXRob2RdO1xuICAgICAgcmV0dXJuIGZ1bmMgPT0gbnVsbCA/IGZ1bmMgOiBmdW5jLmFwcGx5KHZhbHVlLCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBDb252ZW5pZW5jZSB2ZXJzaW9uIG9mIGEgY29tbW9uIHVzZSBjYXNlIG9mIGBtYXBgOiBmZXRjaGluZyBhIHByb3BlcnR5LlxuICBfLnBsdWNrID0gZnVuY3Rpb24ob2JqLCBrZXkpIHtcbiAgICByZXR1cm4gXy5tYXAob2JqLCBfLnByb3BlcnR5KGtleSkpO1xuICB9O1xuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYGZpbHRlcmA6IHNlbGVjdGluZyBvbmx5IG9iamVjdHNcbiAgLy8gY29udGFpbmluZyBzcGVjaWZpYyBga2V5OnZhbHVlYCBwYWlycy5cbiAgXy53aGVyZSA9IGZ1bmN0aW9uKG9iaiwgYXR0cnMpIHtcbiAgICByZXR1cm4gXy5maWx0ZXIob2JqLCBfLm1hdGNoZXIoYXR0cnMpKTtcbiAgfTtcblxuICAvLyBDb252ZW5pZW5jZSB2ZXJzaW9uIG9mIGEgY29tbW9uIHVzZSBjYXNlIG9mIGBmaW5kYDogZ2V0dGluZyB0aGUgZmlyc3Qgb2JqZWN0XG4gIC8vIGNvbnRhaW5pbmcgc3BlY2lmaWMgYGtleTp2YWx1ZWAgcGFpcnMuXG4gIF8uZmluZFdoZXJlID0gZnVuY3Rpb24ob2JqLCBhdHRycykge1xuICAgIHJldHVybiBfLmZpbmQob2JqLCBfLm1hdGNoZXIoYXR0cnMpKTtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIG1heGltdW0gZWxlbWVudCAob3IgZWxlbWVudC1iYXNlZCBjb21wdXRhdGlvbikuXG4gIF8ubWF4ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHQgPSAtSW5maW5pdHksIGxhc3RDb21wdXRlZCA9IC1JbmZpbml0eSxcbiAgICAgICAgdmFsdWUsIGNvbXB1dGVkO1xuICAgIGlmIChpdGVyYXRlZSA9PSBudWxsICYmIG9iaiAhPSBudWxsKSB7XG4gICAgICBvYmogPSBpc0FycmF5TGlrZShvYmopID8gb2JqIDogXy52YWx1ZXMob2JqKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFsdWUgPSBvYmpbaV07XG4gICAgICAgIGlmICh2YWx1ZSA+IHJlc3VsdCkge1xuICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGl0ZXJhdGVlID0gY2IoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgIGNvbXB1dGVkID0gaXRlcmF0ZWUodmFsdWUsIGluZGV4LCBsaXN0KTtcbiAgICAgICAgaWYgKGNvbXB1dGVkID4gbGFzdENvbXB1dGVkIHx8IGNvbXB1dGVkID09PSAtSW5maW5pdHkgJiYgcmVzdWx0ID09PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICBsYXN0Q29tcHV0ZWQgPSBjb21wdXRlZDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBtaW5pbXVtIGVsZW1lbnQgKG9yIGVsZW1lbnQtYmFzZWQgY29tcHV0YXRpb24pLlxuICBfLm1pbiA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0ID0gSW5maW5pdHksIGxhc3RDb21wdXRlZCA9IEluZmluaXR5LFxuICAgICAgICB2YWx1ZSwgY29tcHV0ZWQ7XG4gICAgaWYgKGl0ZXJhdGVlID09IG51bGwgJiYgb2JqICE9IG51bGwpIHtcbiAgICAgIG9iaiA9IGlzQXJyYXlMaWtlKG9iaikgPyBvYmogOiBfLnZhbHVlcyhvYmopO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB2YWx1ZSA9IG9ialtpXTtcbiAgICAgICAgaWYgKHZhbHVlIDwgcmVzdWx0KSB7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaXRlcmF0ZWUgPSBjYihpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgY29tcHV0ZWQgPSBpdGVyYXRlZSh2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgICAgICBpZiAoY29tcHV0ZWQgPCBsYXN0Q29tcHV0ZWQgfHwgY29tcHV0ZWQgPT09IEluZmluaXR5ICYmIHJlc3VsdCA9PT0gSW5maW5pdHkpIHtcbiAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICBsYXN0Q29tcHV0ZWQgPSBjb21wdXRlZDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gU2h1ZmZsZSBhIGNvbGxlY3Rpb24sIHVzaW5nIHRoZSBtb2Rlcm4gdmVyc2lvbiBvZiB0aGVcbiAgLy8gW0Zpc2hlci1ZYXRlcyBzaHVmZmxlXShodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Zpc2hlcuKAk1lhdGVzX3NodWZmbGUpLlxuICBfLnNodWZmbGUgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgc2V0ID0gaXNBcnJheUxpa2Uob2JqKSA/IG9iaiA6IF8udmFsdWVzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IHNldC5sZW5ndGg7XG4gICAgdmFyIHNodWZmbGVkID0gQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpbmRleCA9IDAsIHJhbmQ7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICByYW5kID0gXy5yYW5kb20oMCwgaW5kZXgpO1xuICAgICAgaWYgKHJhbmQgIT09IGluZGV4KSBzaHVmZmxlZFtpbmRleF0gPSBzaHVmZmxlZFtyYW5kXTtcbiAgICAgIHNodWZmbGVkW3JhbmRdID0gc2V0W2luZGV4XTtcbiAgICB9XG4gICAgcmV0dXJuIHNodWZmbGVkO1xuICB9O1xuXG4gIC8vIFNhbXBsZSAqKm4qKiByYW5kb20gdmFsdWVzIGZyb20gYSBjb2xsZWN0aW9uLlxuICAvLyBJZiAqKm4qKiBpcyBub3Qgc3BlY2lmaWVkLCByZXR1cm5zIGEgc2luZ2xlIHJhbmRvbSBlbGVtZW50LlxuICAvLyBUaGUgaW50ZXJuYWwgYGd1YXJkYCBhcmd1bWVudCBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBtYXBgLlxuICBfLnNhbXBsZSA9IGZ1bmN0aW9uKG9iaiwgbiwgZ3VhcmQpIHtcbiAgICBpZiAobiA9PSBudWxsIHx8IGd1YXJkKSB7XG4gICAgICBpZiAoIWlzQXJyYXlMaWtlKG9iaikpIG9iaiA9IF8udmFsdWVzKG9iaik7XG4gICAgICByZXR1cm4gb2JqW18ucmFuZG9tKG9iai5sZW5ndGggLSAxKV07XG4gICAgfVxuICAgIHJldHVybiBfLnNodWZmbGUob2JqKS5zbGljZSgwLCBNYXRoLm1heCgwLCBuKSk7XG4gIH07XG5cbiAgLy8gU29ydCB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uIHByb2R1Y2VkIGJ5IGFuIGl0ZXJhdGVlLlxuICBfLnNvcnRCeSA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRlZSA9IGNiKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICByZXR1cm4gXy5wbHVjayhfLm1hcChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgIGNyaXRlcmlhOiBpdGVyYXRlZSh2YWx1ZSwgaW5kZXgsIGxpc3QpXG4gICAgICB9O1xuICAgIH0pLnNvcnQoZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgIHZhciBhID0gbGVmdC5jcml0ZXJpYTtcbiAgICAgIHZhciBiID0gcmlnaHQuY3JpdGVyaWE7XG4gICAgICBpZiAoYSAhPT0gYikge1xuICAgICAgICBpZiAoYSA+IGIgfHwgYSA9PT0gdm9pZCAwKSByZXR1cm4gMTtcbiAgICAgICAgaWYgKGEgPCBiIHx8IGIgPT09IHZvaWQgMCkgcmV0dXJuIC0xO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGxlZnQuaW5kZXggLSByaWdodC5pbmRleDtcbiAgICB9KSwgJ3ZhbHVlJyk7XG4gIH07XG5cbiAgLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gdXNlZCBmb3IgYWdncmVnYXRlIFwiZ3JvdXAgYnlcIiBvcGVyYXRpb25zLlxuICB2YXIgZ3JvdXAgPSBmdW5jdGlvbihiZWhhdmlvcikge1xuICAgIHJldHVybiBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgICBpdGVyYXRlZSA9IGNiKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICB2YXIga2V5ID0gaXRlcmF0ZWUodmFsdWUsIGluZGV4LCBvYmopO1xuICAgICAgICBiZWhhdmlvcihyZXN1bHQsIHZhbHVlLCBrZXkpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH07XG5cbiAgLy8gR3JvdXBzIHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24uIFBhc3MgZWl0aGVyIGEgc3RyaW5nIGF0dHJpYnV0ZVxuICAvLyB0byBncm91cCBieSwgb3IgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIGNyaXRlcmlvbi5cbiAgXy5ncm91cEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCB2YWx1ZSwga2V5KSB7XG4gICAgaWYgKF8uaGFzKHJlc3VsdCwga2V5KSkgcmVzdWx0W2tleV0ucHVzaCh2YWx1ZSk7IGVsc2UgcmVzdWx0W2tleV0gPSBbdmFsdWVdO1xuICB9KTtcblxuICAvLyBJbmRleGVzIHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24sIHNpbWlsYXIgdG8gYGdyb3VwQnlgLCBidXQgZm9yXG4gIC8vIHdoZW4geW91IGtub3cgdGhhdCB5b3VyIGluZGV4IHZhbHVlcyB3aWxsIGJlIHVuaXF1ZS5cbiAgXy5pbmRleEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCB2YWx1ZSwga2V5KSB7XG4gICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgfSk7XG5cbiAgLy8gQ291bnRzIGluc3RhbmNlcyBvZiBhbiBvYmplY3QgdGhhdCBncm91cCBieSBhIGNlcnRhaW4gY3JpdGVyaW9uLiBQYXNzXG4gIC8vIGVpdGhlciBhIHN0cmluZyBhdHRyaWJ1dGUgdG8gY291bnQgYnksIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZVxuICAvLyBjcml0ZXJpb24uXG4gIF8uY291bnRCeSA9IGdyb3VwKGZ1bmN0aW9uKHJlc3VsdCwgdmFsdWUsIGtleSkge1xuICAgIGlmIChfLmhhcyhyZXN1bHQsIGtleSkpIHJlc3VsdFtrZXldKys7IGVsc2UgcmVzdWx0W2tleV0gPSAxO1xuICB9KTtcblxuICAvLyBTYWZlbHkgY3JlYXRlIGEgcmVhbCwgbGl2ZSBhcnJheSBmcm9tIGFueXRoaW5nIGl0ZXJhYmxlLlxuICBfLnRvQXJyYXkgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIW9iaikgcmV0dXJuIFtdO1xuICAgIGlmIChfLmlzQXJyYXkob2JqKSkgcmV0dXJuIHNsaWNlLmNhbGwob2JqKTtcbiAgICBpZiAoaXNBcnJheUxpa2Uob2JqKSkgcmV0dXJuIF8ubWFwKG9iaiwgXy5pZGVudGl0eSk7XG4gICAgcmV0dXJuIF8udmFsdWVzKG9iaik7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBudW1iZXIgb2YgZWxlbWVudHMgaW4gYW4gb2JqZWN0LlxuICBfLnNpemUgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiAwO1xuICAgIHJldHVybiBpc0FycmF5TGlrZShvYmopID8gb2JqLmxlbmd0aCA6IF8ua2V5cyhvYmopLmxlbmd0aDtcbiAgfTtcblxuICAvLyBTcGxpdCBhIGNvbGxlY3Rpb24gaW50byB0d28gYXJyYXlzOiBvbmUgd2hvc2UgZWxlbWVudHMgYWxsIHNhdGlzZnkgdGhlIGdpdmVuXG4gIC8vIHByZWRpY2F0ZSwgYW5kIG9uZSB3aG9zZSBlbGVtZW50cyBhbGwgZG8gbm90IHNhdGlzZnkgdGhlIHByZWRpY2F0ZS5cbiAgXy5wYXJ0aXRpb24gPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHByZWRpY2F0ZSA9IGNiKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgdmFyIHBhc3MgPSBbXSwgZmFpbCA9IFtdO1xuICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBrZXksIG9iaikge1xuICAgICAgKHByZWRpY2F0ZSh2YWx1ZSwga2V5LCBvYmopID8gcGFzcyA6IGZhaWwpLnB1c2godmFsdWUpO1xuICAgIH0pO1xuICAgIHJldHVybiBbcGFzcywgZmFpbF07XG4gIH07XG5cbiAgLy8gQXJyYXkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIEdldCB0aGUgZmlyc3QgZWxlbWVudCBvZiBhbiBhcnJheS4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiB0aGUgZmlyc3QgTlxuICAvLyB2YWx1ZXMgaW4gdGhlIGFycmF5LiBBbGlhc2VkIGFzIGBoZWFkYCBhbmQgYHRha2VgLiBUaGUgKipndWFyZCoqIGNoZWNrXG4gIC8vIGFsbG93cyBpdCB0byB3b3JrIHdpdGggYF8ubWFwYC5cbiAgXy5maXJzdCA9IF8uaGVhZCA9IF8udGFrZSA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIGlmIChuID09IG51bGwgfHwgZ3VhcmQpIHJldHVybiBhcnJheVswXTtcbiAgICByZXR1cm4gXy5pbml0aWFsKGFycmF5LCBhcnJheS5sZW5ndGggLSBuKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGV2ZXJ5dGhpbmcgYnV0IHRoZSBsYXN0IGVudHJ5IG9mIHRoZSBhcnJheS4gRXNwZWNpYWxseSB1c2VmdWwgb25cbiAgLy8gdGhlIGFyZ3VtZW50cyBvYmplY3QuIFBhc3NpbmcgKipuKiogd2lsbCByZXR1cm4gYWxsIHRoZSB2YWx1ZXMgaW5cbiAgLy8gdGhlIGFycmF5LCBleGNsdWRpbmcgdGhlIGxhc3QgTi5cbiAgXy5pbml0aWFsID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIDAsIE1hdGgubWF4KDAsIGFycmF5Lmxlbmd0aCAtIChuID09IG51bGwgfHwgZ3VhcmQgPyAxIDogbikpKTtcbiAgfTtcblxuICAvLyBHZXQgdGhlIGxhc3QgZWxlbWVudCBvZiBhbiBhcnJheS4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiB0aGUgbGFzdCBOXG4gIC8vIHZhbHVlcyBpbiB0aGUgYXJyYXkuXG4gIF8ubGFzdCA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIGlmIChuID09IG51bGwgfHwgZ3VhcmQpIHJldHVybiBhcnJheVthcnJheS5sZW5ndGggLSAxXTtcbiAgICByZXR1cm4gXy5yZXN0KGFycmF5LCBNYXRoLm1heCgwLCBhcnJheS5sZW5ndGggLSBuKSk7XG4gIH07XG5cbiAgLy8gUmV0dXJucyBldmVyeXRoaW5nIGJ1dCB0aGUgZmlyc3QgZW50cnkgb2YgdGhlIGFycmF5LiBBbGlhc2VkIGFzIGB0YWlsYCBhbmQgYGRyb3BgLlxuICAvLyBFc3BlY2lhbGx5IHVzZWZ1bCBvbiB0aGUgYXJndW1lbnRzIG9iamVjdC4gUGFzc2luZyBhbiAqKm4qKiB3aWxsIHJldHVyblxuICAvLyB0aGUgcmVzdCBOIHZhbHVlcyBpbiB0aGUgYXJyYXkuXG4gIF8ucmVzdCA9IF8udGFpbCA9IF8uZHJvcCA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIHJldHVybiBzbGljZS5jYWxsKGFycmF5LCBuID09IG51bGwgfHwgZ3VhcmQgPyAxIDogbik7XG4gIH07XG5cbiAgLy8gVHJpbSBvdXQgYWxsIGZhbHN5IHZhbHVlcyBmcm9tIGFuIGFycmF5LlxuICBfLmNvbXBhY3QgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHJldHVybiBfLmZpbHRlcihhcnJheSwgXy5pZGVudGl0eSk7XG4gIH07XG5cbiAgLy8gSW50ZXJuYWwgaW1wbGVtZW50YXRpb24gb2YgYSByZWN1cnNpdmUgYGZsYXR0ZW5gIGZ1bmN0aW9uLlxuICB2YXIgZmxhdHRlbiA9IGZ1bmN0aW9uKGlucHV0LCBzaGFsbG93LCBzdHJpY3QsIHN0YXJ0SW5kZXgpIHtcbiAgICB2YXIgb3V0cHV0ID0gW10sIGlkeCA9IDA7XG4gICAgZm9yICh2YXIgaSA9IHN0YXJ0SW5kZXggfHwgMCwgbGVuZ3RoID0gZ2V0TGVuZ3RoKGlucHV0KTsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdmFsdWUgPSBpbnB1dFtpXTtcbiAgICAgIGlmIChpc0FycmF5TGlrZSh2YWx1ZSkgJiYgKF8uaXNBcnJheSh2YWx1ZSkgfHwgXy5pc0FyZ3VtZW50cyh2YWx1ZSkpKSB7XG4gICAgICAgIC8vZmxhdHRlbiBjdXJyZW50IGxldmVsIG9mIGFycmF5IG9yIGFyZ3VtZW50cyBvYmplY3RcbiAgICAgICAgaWYgKCFzaGFsbG93KSB2YWx1ZSA9IGZsYXR0ZW4odmFsdWUsIHNoYWxsb3csIHN0cmljdCk7XG4gICAgICAgIHZhciBqID0gMCwgbGVuID0gdmFsdWUubGVuZ3RoO1xuICAgICAgICBvdXRwdXQubGVuZ3RoICs9IGxlbjtcbiAgICAgICAgd2hpbGUgKGogPCBsZW4pIHtcbiAgICAgICAgICBvdXRwdXRbaWR4KytdID0gdmFsdWVbaisrXTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghc3RyaWN0KSB7XG4gICAgICAgIG91dHB1dFtpZHgrK10gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfTtcblxuICAvLyBGbGF0dGVuIG91dCBhbiBhcnJheSwgZWl0aGVyIHJlY3Vyc2l2ZWx5IChieSBkZWZhdWx0KSwgb3IganVzdCBvbmUgbGV2ZWwuXG4gIF8uZmxhdHRlbiA9IGZ1bmN0aW9uKGFycmF5LCBzaGFsbG93KSB7XG4gICAgcmV0dXJuIGZsYXR0ZW4oYXJyYXksIHNoYWxsb3csIGZhbHNlKTtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSB2ZXJzaW9uIG9mIHRoZSBhcnJheSB0aGF0IGRvZXMgbm90IGNvbnRhaW4gdGhlIHNwZWNpZmllZCB2YWx1ZShzKS5cbiAgXy53aXRob3V0ID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICByZXR1cm4gXy5kaWZmZXJlbmNlKGFycmF5LCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICB9O1xuXG4gIC8vIFByb2R1Y2UgYSBkdXBsaWNhdGUtZnJlZSB2ZXJzaW9uIG9mIHRoZSBhcnJheS4gSWYgdGhlIGFycmF5IGhhcyBhbHJlYWR5XG4gIC8vIGJlZW4gc29ydGVkLCB5b3UgaGF2ZSB0aGUgb3B0aW9uIG9mIHVzaW5nIGEgZmFzdGVyIGFsZ29yaXRobS5cbiAgLy8gQWxpYXNlZCBhcyBgdW5pcXVlYC5cbiAgXy51bmlxID0gXy51bmlxdWUgPSBmdW5jdGlvbihhcnJheSwgaXNTb3J0ZWQsIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaWYgKCFfLmlzQm9vbGVhbihpc1NvcnRlZCkpIHtcbiAgICAgIGNvbnRleHQgPSBpdGVyYXRlZTtcbiAgICAgIGl0ZXJhdGVlID0gaXNTb3J0ZWQ7XG4gICAgICBpc1NvcnRlZCA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAoaXRlcmF0ZWUgIT0gbnVsbCkgaXRlcmF0ZWUgPSBjYihpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIHZhciBzZWVuID0gW107XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGdldExlbmd0aChhcnJheSk7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHZhbHVlID0gYXJyYXlbaV0sXG4gICAgICAgICAgY29tcHV0ZWQgPSBpdGVyYXRlZSA/IGl0ZXJhdGVlKHZhbHVlLCBpLCBhcnJheSkgOiB2YWx1ZTtcbiAgICAgIGlmIChpc1NvcnRlZCkge1xuICAgICAgICBpZiAoIWkgfHwgc2VlbiAhPT0gY29tcHV0ZWQpIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgICAgc2VlbiA9IGNvbXB1dGVkO1xuICAgICAgfSBlbHNlIGlmIChpdGVyYXRlZSkge1xuICAgICAgICBpZiAoIV8uY29udGFpbnMoc2VlbiwgY29tcHV0ZWQpKSB7XG4gICAgICAgICAgc2Vlbi5wdXNoKGNvbXB1dGVkKTtcbiAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIV8uY29udGFpbnMocmVzdWx0LCB2YWx1ZSkpIHtcbiAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFByb2R1Y2UgYW4gYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdW5pb246IGVhY2ggZGlzdGluY3QgZWxlbWVudCBmcm9tIGFsbCBvZlxuICAvLyB0aGUgcGFzc2VkLWluIGFycmF5cy5cbiAgXy51bmlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfLnVuaXEoZmxhdHRlbihhcmd1bWVudHMsIHRydWUsIHRydWUpKTtcbiAgfTtcblxuICAvLyBQcm9kdWNlIGFuIGFycmF5IHRoYXQgY29udGFpbnMgZXZlcnkgaXRlbSBzaGFyZWQgYmV0d2VlbiBhbGwgdGhlXG4gIC8vIHBhc3NlZC1pbiBhcnJheXMuXG4gIF8uaW50ZXJzZWN0aW9uID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgdmFyIGFyZ3NMZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBnZXRMZW5ndGgoYXJyYXkpOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBpdGVtID0gYXJyYXlbaV07XG4gICAgICBpZiAoXy5jb250YWlucyhyZXN1bHQsIGl0ZW0pKSBjb250aW51ZTtcbiAgICAgIGZvciAodmFyIGogPSAxOyBqIDwgYXJnc0xlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmICghXy5jb250YWlucyhhcmd1bWVudHNbal0sIGl0ZW0pKSBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmIChqID09PSBhcmdzTGVuZ3RoKSByZXN1bHQucHVzaChpdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBUYWtlIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gb25lIGFycmF5IGFuZCBhIG51bWJlciBvZiBvdGhlciBhcnJheXMuXG4gIC8vIE9ubHkgdGhlIGVsZW1lbnRzIHByZXNlbnQgaW4ganVzdCB0aGUgZmlyc3QgYXJyYXkgd2lsbCByZW1haW4uXG4gIF8uZGlmZmVyZW5jZSA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgdmFyIHJlc3QgPSBmbGF0dGVuKGFyZ3VtZW50cywgdHJ1ZSwgdHJ1ZSwgMSk7XG4gICAgcmV0dXJuIF8uZmlsdGVyKGFycmF5LCBmdW5jdGlvbih2YWx1ZSl7XG4gICAgICByZXR1cm4gIV8uY29udGFpbnMocmVzdCwgdmFsdWUpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIFppcCB0b2dldGhlciBtdWx0aXBsZSBsaXN0cyBpbnRvIGEgc2luZ2xlIGFycmF5IC0tIGVsZW1lbnRzIHRoYXQgc2hhcmVcbiAgLy8gYW4gaW5kZXggZ28gdG9nZXRoZXIuXG4gIF8uemlwID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF8udW56aXAoYXJndW1lbnRzKTtcbiAgfTtcblxuICAvLyBDb21wbGVtZW50IG9mIF8uemlwLiBVbnppcCBhY2NlcHRzIGFuIGFycmF5IG9mIGFycmF5cyBhbmQgZ3JvdXBzXG4gIC8vIGVhY2ggYXJyYXkncyBlbGVtZW50cyBvbiBzaGFyZWQgaW5kaWNlc1xuICBfLnVuemlwID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICB2YXIgbGVuZ3RoID0gYXJyYXkgJiYgXy5tYXgoYXJyYXksIGdldExlbmd0aCkubGVuZ3RoIHx8IDA7XG4gICAgdmFyIHJlc3VsdCA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICByZXN1bHRbaW5kZXhdID0gXy5wbHVjayhhcnJheSwgaW5kZXgpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIENvbnZlcnRzIGxpc3RzIGludG8gb2JqZWN0cy4gUGFzcyBlaXRoZXIgYSBzaW5nbGUgYXJyYXkgb2YgYFtrZXksIHZhbHVlXWBcbiAgLy8gcGFpcnMsIG9yIHR3byBwYXJhbGxlbCBhcnJheXMgb2YgdGhlIHNhbWUgbGVuZ3RoIC0tIG9uZSBvZiBrZXlzLCBhbmQgb25lIG9mXG4gIC8vIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlcy5cbiAgXy5vYmplY3QgPSBmdW5jdGlvbihsaXN0LCB2YWx1ZXMpIHtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGdldExlbmd0aChsaXN0KTsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldXSA9IHZhbHVlc1tpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldWzBdXSA9IGxpc3RbaV1bMV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gR2VuZXJhdG9yIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgZmluZEluZGV4IGFuZCBmaW5kTGFzdEluZGV4IGZ1bmN0aW9uc1xuICBmdW5jdGlvbiBjcmVhdGVQcmVkaWNhdGVJbmRleEZpbmRlcihkaXIpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oYXJyYXksIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgICAgcHJlZGljYXRlID0gY2IocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICAgIHZhciBsZW5ndGggPSBnZXRMZW5ndGgoYXJyYXkpO1xuICAgICAgdmFyIGluZGV4ID0gZGlyID4gMCA/IDAgOiBsZW5ndGggLSAxO1xuICAgICAgZm9yICg7IGluZGV4ID49IDAgJiYgaW5kZXggPCBsZW5ndGg7IGluZGV4ICs9IGRpcikge1xuICAgICAgICBpZiAocHJlZGljYXRlKGFycmF5W2luZGV4XSwgaW5kZXgsIGFycmF5KSkgcmV0dXJuIGluZGV4O1xuICAgICAgfVxuICAgICAgcmV0dXJuIC0xO1xuICAgIH07XG4gIH1cblxuICAvLyBSZXR1cm5zIHRoZSBmaXJzdCBpbmRleCBvbiBhbiBhcnJheS1saWtlIHRoYXQgcGFzc2VzIGEgcHJlZGljYXRlIHRlc3RcbiAgXy5maW5kSW5kZXggPSBjcmVhdGVQcmVkaWNhdGVJbmRleEZpbmRlcigxKTtcbiAgXy5maW5kTGFzdEluZGV4ID0gY3JlYXRlUHJlZGljYXRlSW5kZXhGaW5kZXIoLTEpO1xuXG4gIC8vIFVzZSBhIGNvbXBhcmF0b3IgZnVuY3Rpb24gdG8gZmlndXJlIG91dCB0aGUgc21hbGxlc3QgaW5kZXggYXQgd2hpY2hcbiAgLy8gYW4gb2JqZWN0IHNob3VsZCBiZSBpbnNlcnRlZCBzbyBhcyB0byBtYWludGFpbiBvcmRlci4gVXNlcyBiaW5hcnkgc2VhcmNoLlxuICBfLnNvcnRlZEluZGV4ID0gZnVuY3Rpb24oYXJyYXksIG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRlZSA9IGNiKGl0ZXJhdGVlLCBjb250ZXh0LCAxKTtcbiAgICB2YXIgdmFsdWUgPSBpdGVyYXRlZShvYmopO1xuICAgIHZhciBsb3cgPSAwLCBoaWdoID0gZ2V0TGVuZ3RoKGFycmF5KTtcbiAgICB3aGlsZSAobG93IDwgaGlnaCkge1xuICAgICAgdmFyIG1pZCA9IE1hdGguZmxvb3IoKGxvdyArIGhpZ2gpIC8gMik7XG4gICAgICBpZiAoaXRlcmF0ZWUoYXJyYXlbbWlkXSkgPCB2YWx1ZSkgbG93ID0gbWlkICsgMTsgZWxzZSBoaWdoID0gbWlkO1xuICAgIH1cbiAgICByZXR1cm4gbG93O1xuICB9O1xuXG4gIC8vIEdlbmVyYXRvciBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGluZGV4T2YgYW5kIGxhc3RJbmRleE9mIGZ1bmN0aW9uc1xuICBmdW5jdGlvbiBjcmVhdGVJbmRleEZpbmRlcihkaXIsIHByZWRpY2F0ZUZpbmQsIHNvcnRlZEluZGV4KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGFycmF5LCBpdGVtLCBpZHgpIHtcbiAgICAgIHZhciBpID0gMCwgbGVuZ3RoID0gZ2V0TGVuZ3RoKGFycmF5KTtcbiAgICAgIGlmICh0eXBlb2YgaWR4ID09ICdudW1iZXInKSB7XG4gICAgICAgIGlmIChkaXIgPiAwKSB7XG4gICAgICAgICAgICBpID0gaWR4ID49IDAgPyBpZHggOiBNYXRoLm1heChpZHggKyBsZW5ndGgsIGkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGVuZ3RoID0gaWR4ID49IDAgPyBNYXRoLm1pbihpZHggKyAxLCBsZW5ndGgpIDogaWR4ICsgbGVuZ3RoICsgMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzb3J0ZWRJbmRleCAmJiBpZHggJiYgbGVuZ3RoKSB7XG4gICAgICAgIGlkeCA9IHNvcnRlZEluZGV4KGFycmF5LCBpdGVtKTtcbiAgICAgICAgcmV0dXJuIGFycmF5W2lkeF0gPT09IGl0ZW0gPyBpZHggOiAtMTtcbiAgICAgIH1cbiAgICAgIGlmIChpdGVtICE9PSBpdGVtKSB7XG4gICAgICAgIGlkeCA9IHByZWRpY2F0ZUZpbmQoc2xpY2UuY2FsbChhcnJheSwgaSwgbGVuZ3RoKSwgXy5pc05hTik7XG4gICAgICAgIHJldHVybiBpZHggPj0gMCA/IGlkeCArIGkgOiAtMTtcbiAgICAgIH1cbiAgICAgIGZvciAoaWR4ID0gZGlyID4gMCA/IGkgOiBsZW5ndGggLSAxOyBpZHggPj0gMCAmJiBpZHggPCBsZW5ndGg7IGlkeCArPSBkaXIpIHtcbiAgICAgICAgaWYgKGFycmF5W2lkeF0gPT09IGl0ZW0pIHJldHVybiBpZHg7XG4gICAgICB9XG4gICAgICByZXR1cm4gLTE7XG4gICAgfTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgcG9zaXRpb24gb2YgdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2YgYW4gaXRlbSBpbiBhbiBhcnJheSxcbiAgLy8gb3IgLTEgaWYgdGhlIGl0ZW0gaXMgbm90IGluY2x1ZGVkIGluIHRoZSBhcnJheS5cbiAgLy8gSWYgdGhlIGFycmF5IGlzIGxhcmdlIGFuZCBhbHJlYWR5IGluIHNvcnQgb3JkZXIsIHBhc3MgYHRydWVgXG4gIC8vIGZvciAqKmlzU29ydGVkKiogdG8gdXNlIGJpbmFyeSBzZWFyY2guXG4gIF8uaW5kZXhPZiA9IGNyZWF0ZUluZGV4RmluZGVyKDEsIF8uZmluZEluZGV4LCBfLnNvcnRlZEluZGV4KTtcbiAgXy5sYXN0SW5kZXhPZiA9IGNyZWF0ZUluZGV4RmluZGVyKC0xLCBfLmZpbmRMYXN0SW5kZXgpO1xuXG4gIC8vIEdlbmVyYXRlIGFuIGludGVnZXIgQXJyYXkgY29udGFpbmluZyBhbiBhcml0aG1ldGljIHByb2dyZXNzaW9uLiBBIHBvcnQgb2ZcbiAgLy8gdGhlIG5hdGl2ZSBQeXRob24gYHJhbmdlKClgIGZ1bmN0aW9uLiBTZWVcbiAgLy8gW3RoZSBQeXRob24gZG9jdW1lbnRhdGlvbl0oaHR0cDovL2RvY3MucHl0aG9uLm9yZy9saWJyYXJ5L2Z1bmN0aW9ucy5odG1sI3JhbmdlKS5cbiAgXy5yYW5nZSA9IGZ1bmN0aW9uKHN0YXJ0LCBzdG9wLCBzdGVwKSB7XG4gICAgaWYgKHN0b3AgPT0gbnVsbCkge1xuICAgICAgc3RvcCA9IHN0YXJ0IHx8IDA7XG4gICAgICBzdGFydCA9IDA7XG4gICAgfVxuICAgIHN0ZXAgPSBzdGVwIHx8IDE7XG5cbiAgICB2YXIgbGVuZ3RoID0gTWF0aC5tYXgoTWF0aC5jZWlsKChzdG9wIC0gc3RhcnQpIC8gc3RlcCksIDApO1xuICAgIHZhciByYW5nZSA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICBmb3IgKHZhciBpZHggPSAwOyBpZHggPCBsZW5ndGg7IGlkeCsrLCBzdGFydCArPSBzdGVwKSB7XG4gICAgICByYW5nZVtpZHhdID0gc3RhcnQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJhbmdlO1xuICB9O1xuXG4gIC8vIEZ1bmN0aW9uIChhaGVtKSBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gRGV0ZXJtaW5lcyB3aGV0aGVyIHRvIGV4ZWN1dGUgYSBmdW5jdGlvbiBhcyBhIGNvbnN0cnVjdG9yXG4gIC8vIG9yIGEgbm9ybWFsIGZ1bmN0aW9uIHdpdGggdGhlIHByb3ZpZGVkIGFyZ3VtZW50c1xuICB2YXIgZXhlY3V0ZUJvdW5kID0gZnVuY3Rpb24oc291cmNlRnVuYywgYm91bmRGdW5jLCBjb250ZXh0LCBjYWxsaW5nQ29udGV4dCwgYXJncykge1xuICAgIGlmICghKGNhbGxpbmdDb250ZXh0IGluc3RhbmNlb2YgYm91bmRGdW5jKSkgcmV0dXJuIHNvdXJjZUZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgdmFyIHNlbGYgPSBiYXNlQ3JlYXRlKHNvdXJjZUZ1bmMucHJvdG90eXBlKTtcbiAgICB2YXIgcmVzdWx0ID0gc291cmNlRnVuYy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICBpZiAoXy5pc09iamVjdChyZXN1bHQpKSByZXR1cm4gcmVzdWx0O1xuICAgIHJldHVybiBzZWxmO1xuICB9O1xuXG4gIC8vIENyZWF0ZSBhIGZ1bmN0aW9uIGJvdW5kIHRvIGEgZ2l2ZW4gb2JqZWN0IChhc3NpZ25pbmcgYHRoaXNgLCBhbmQgYXJndW1lbnRzLFxuICAvLyBvcHRpb25hbGx5KS4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYEZ1bmN0aW9uLmJpbmRgIGlmXG4gIC8vIGF2YWlsYWJsZS5cbiAgXy5iaW5kID0gZnVuY3Rpb24oZnVuYywgY29udGV4dCkge1xuICAgIGlmIChuYXRpdmVCaW5kICYmIGZ1bmMuYmluZCA9PT0gbmF0aXZlQmluZCkgcmV0dXJuIG5hdGl2ZUJpbmQuYXBwbHkoZnVuYywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICBpZiAoIV8uaXNGdW5jdGlvbihmdW5jKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQmluZCBtdXN0IGJlIGNhbGxlZCBvbiBhIGZ1bmN0aW9uJyk7XG4gICAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIGJvdW5kID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZXhlY3V0ZUJvdW5kKGZ1bmMsIGJvdW5kLCBjb250ZXh0LCB0aGlzLCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICB9O1xuICAgIHJldHVybiBib3VuZDtcbiAgfTtcblxuICAvLyBQYXJ0aWFsbHkgYXBwbHkgYSBmdW5jdGlvbiBieSBjcmVhdGluZyBhIHZlcnNpb24gdGhhdCBoYXMgaGFkIHNvbWUgb2YgaXRzXG4gIC8vIGFyZ3VtZW50cyBwcmUtZmlsbGVkLCB3aXRob3V0IGNoYW5naW5nIGl0cyBkeW5hbWljIGB0aGlzYCBjb250ZXh0LiBfIGFjdHNcbiAgLy8gYXMgYSBwbGFjZWhvbGRlciwgYWxsb3dpbmcgYW55IGNvbWJpbmF0aW9uIG9mIGFyZ3VtZW50cyB0byBiZSBwcmUtZmlsbGVkLlxuICBfLnBhcnRpYWwgPSBmdW5jdGlvbihmdW5jKSB7XG4gICAgdmFyIGJvdW5kQXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICB2YXIgYm91bmQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwb3NpdGlvbiA9IDAsIGxlbmd0aCA9IGJvdW5kQXJncy5sZW5ndGg7XG4gICAgICB2YXIgYXJncyA9IEFycmF5KGxlbmd0aCk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGFyZ3NbaV0gPSBib3VuZEFyZ3NbaV0gPT09IF8gPyBhcmd1bWVudHNbcG9zaXRpb24rK10gOiBib3VuZEFyZ3NbaV07XG4gICAgICB9XG4gICAgICB3aGlsZSAocG9zaXRpb24gPCBhcmd1bWVudHMubGVuZ3RoKSBhcmdzLnB1c2goYXJndW1lbnRzW3Bvc2l0aW9uKytdKTtcbiAgICAgIHJldHVybiBleGVjdXRlQm91bmQoZnVuYywgYm91bmQsIHRoaXMsIHRoaXMsIGFyZ3MpO1xuICAgIH07XG4gICAgcmV0dXJuIGJvdW5kO1xuICB9O1xuXG4gIC8vIEJpbmQgYSBudW1iZXIgb2YgYW4gb2JqZWN0J3MgbWV0aG9kcyB0byB0aGF0IG9iamVjdC4gUmVtYWluaW5nIGFyZ3VtZW50c1xuICAvLyBhcmUgdGhlIG1ldGhvZCBuYW1lcyB0byBiZSBib3VuZC4gVXNlZnVsIGZvciBlbnN1cmluZyB0aGF0IGFsbCBjYWxsYmFja3NcbiAgLy8gZGVmaW5lZCBvbiBhbiBvYmplY3QgYmVsb25nIHRvIGl0LlxuICBfLmJpbmRBbGwgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgaSwgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCwga2V5O1xuICAgIGlmIChsZW5ndGggPD0gMSkgdGhyb3cgbmV3IEVycm9yKCdiaW5kQWxsIG11c3QgYmUgcGFzc2VkIGZ1bmN0aW9uIG5hbWVzJyk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBrZXkgPSBhcmd1bWVudHNbaV07XG4gICAgICBvYmpba2V5XSA9IF8uYmluZChvYmpba2V5XSwgb2JqKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBNZW1vaXplIGFuIGV4cGVuc2l2ZSBmdW5jdGlvbiBieSBzdG9yaW5nIGl0cyByZXN1bHRzLlxuICBfLm1lbW9pemUgPSBmdW5jdGlvbihmdW5jLCBoYXNoZXIpIHtcbiAgICB2YXIgbWVtb2l6ZSA9IGZ1bmN0aW9uKGtleSkge1xuICAgICAgdmFyIGNhY2hlID0gbWVtb2l6ZS5jYWNoZTtcbiAgICAgIHZhciBhZGRyZXNzID0gJycgKyAoaGFzaGVyID8gaGFzaGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykgOiBrZXkpO1xuICAgICAgaWYgKCFfLmhhcyhjYWNoZSwgYWRkcmVzcykpIGNhY2hlW2FkZHJlc3NdID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIGNhY2hlW2FkZHJlc3NdO1xuICAgIH07XG4gICAgbWVtb2l6ZS5jYWNoZSA9IHt9O1xuICAgIHJldHVybiBtZW1vaXplO1xuICB9O1xuXG4gIC8vIERlbGF5cyBhIGZ1bmN0aW9uIGZvciB0aGUgZ2l2ZW4gbnVtYmVyIG9mIG1pbGxpc2Vjb25kcywgYW5kIHRoZW4gY2FsbHNcbiAgLy8gaXQgd2l0aCB0aGUgYXJndW1lbnRzIHN1cHBsaWVkLlxuICBfLmRlbGF5ID0gZnVuY3Rpb24oZnVuYywgd2FpdCkge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gZnVuYy5hcHBseShudWxsLCBhcmdzKTtcbiAgICB9LCB3YWl0KTtcbiAgfTtcblxuICAvLyBEZWZlcnMgYSBmdW5jdGlvbiwgc2NoZWR1bGluZyBpdCB0byBydW4gYWZ0ZXIgdGhlIGN1cnJlbnQgY2FsbCBzdGFjayBoYXNcbiAgLy8gY2xlYXJlZC5cbiAgXy5kZWZlciA9IF8ucGFydGlhbChfLmRlbGF5LCBfLCAxKTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24sIHRoYXQsIHdoZW4gaW52b2tlZCwgd2lsbCBvbmx5IGJlIHRyaWdnZXJlZCBhdCBtb3N0IG9uY2VcbiAgLy8gZHVyaW5nIGEgZ2l2ZW4gd2luZG93IG9mIHRpbWUuIE5vcm1hbGx5LCB0aGUgdGhyb3R0bGVkIGZ1bmN0aW9uIHdpbGwgcnVuXG4gIC8vIGFzIG11Y2ggYXMgaXQgY2FuLCB3aXRob3V0IGV2ZXIgZ29pbmcgbW9yZSB0aGFuIG9uY2UgcGVyIGB3YWl0YCBkdXJhdGlvbjtcbiAgLy8gYnV0IGlmIHlvdSdkIGxpa2UgdG8gZGlzYWJsZSB0aGUgZXhlY3V0aW9uIG9uIHRoZSBsZWFkaW5nIGVkZ2UsIHBhc3NcbiAgLy8gYHtsZWFkaW5nOiBmYWxzZX1gLiBUbyBkaXNhYmxlIGV4ZWN1dGlvbiBvbiB0aGUgdHJhaWxpbmcgZWRnZSwgZGl0dG8uXG4gIF8udGhyb3R0bGUgPSBmdW5jdGlvbihmdW5jLCB3YWl0LCBvcHRpb25zKSB7XG4gICAgdmFyIGNvbnRleHQsIGFyZ3MsIHJlc3VsdDtcbiAgICB2YXIgdGltZW91dCA9IG51bGw7XG4gICAgdmFyIHByZXZpb3VzID0gMDtcbiAgICBpZiAoIW9wdGlvbnMpIG9wdGlvbnMgPSB7fTtcbiAgICB2YXIgbGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHByZXZpb3VzID0gb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSA/IDAgOiBfLm5vdygpO1xuICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgaWYgKCF0aW1lb3V0KSBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgfTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbm93ID0gXy5ub3coKTtcbiAgICAgIGlmICghcHJldmlvdXMgJiYgb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSkgcHJldmlvdXMgPSBub3c7XG4gICAgICB2YXIgcmVtYWluaW5nID0gd2FpdCAtIChub3cgLSBwcmV2aW91cyk7XG4gICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICBpZiAocmVtYWluaW5nIDw9IDAgfHwgcmVtYWluaW5nID4gd2FpdCkge1xuICAgICAgICBpZiAodGltZW91dCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBwcmV2aW91cyA9IG5vdztcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgaWYgKCF0aW1lb3V0KSBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKCF0aW1lb3V0ICYmIG9wdGlvbnMudHJhaWxpbmcgIT09IGZhbHNlKSB7XG4gICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCByZW1haW5pbmcpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiwgdGhhdCwgYXMgbG9uZyBhcyBpdCBjb250aW51ZXMgdG8gYmUgaW52b2tlZCwgd2lsbCBub3RcbiAgLy8gYmUgdHJpZ2dlcmVkLiBUaGUgZnVuY3Rpb24gd2lsbCBiZSBjYWxsZWQgYWZ0ZXIgaXQgc3RvcHMgYmVpbmcgY2FsbGVkIGZvclxuICAvLyBOIG1pbGxpc2Vjb25kcy4gSWYgYGltbWVkaWF0ZWAgaXMgcGFzc2VkLCB0cmlnZ2VyIHRoZSBmdW5jdGlvbiBvbiB0aGVcbiAgLy8gbGVhZGluZyBlZGdlLCBpbnN0ZWFkIG9mIHRoZSB0cmFpbGluZy5cbiAgXy5kZWJvdW5jZSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIGltbWVkaWF0ZSkge1xuICAgIHZhciB0aW1lb3V0LCBhcmdzLCBjb250ZXh0LCB0aW1lc3RhbXAsIHJlc3VsdDtcblxuICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGxhc3QgPSBfLm5vdygpIC0gdGltZXN0YW1wO1xuXG4gICAgICBpZiAobGFzdCA8IHdhaXQgJiYgbGFzdCA+PSAwKSB7XG4gICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0IC0gbGFzdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgaWYgKCFpbW1lZGlhdGUpIHtcbiAgICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICAgIGlmICghdGltZW91dCkgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnRleHQgPSB0aGlzO1xuICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIHRpbWVzdGFtcCA9IF8ubm93KCk7XG4gICAgICB2YXIgY2FsbE5vdyA9IGltbWVkaWF0ZSAmJiAhdGltZW91dDtcbiAgICAgIGlmICghdGltZW91dCkgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQpO1xuICAgICAgaWYgKGNhbGxOb3cpIHtcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyB0aGUgZmlyc3QgZnVuY3Rpb24gcGFzc2VkIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSBzZWNvbmQsXG4gIC8vIGFsbG93aW5nIHlvdSB0byBhZGp1c3QgYXJndW1lbnRzLCBydW4gY29kZSBiZWZvcmUgYW5kIGFmdGVyLCBhbmRcbiAgLy8gY29uZGl0aW9uYWxseSBleGVjdXRlIHRoZSBvcmlnaW5hbCBmdW5jdGlvbi5cbiAgXy53cmFwID0gZnVuY3Rpb24oZnVuYywgd3JhcHBlcikge1xuICAgIHJldHVybiBfLnBhcnRpYWwod3JhcHBlciwgZnVuYyk7XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIG5lZ2F0ZWQgdmVyc2lvbiBvZiB0aGUgcGFzc2VkLWluIHByZWRpY2F0ZS5cbiAgXy5uZWdhdGUgPSBmdW5jdGlvbihwcmVkaWNhdGUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gIXByZWRpY2F0ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgaXMgdGhlIGNvbXBvc2l0aW9uIG9mIGEgbGlzdCBvZiBmdW5jdGlvbnMsIGVhY2hcbiAgLy8gY29uc3VtaW5nIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgZm9sbG93cy5cbiAgXy5jb21wb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgdmFyIHN0YXJ0ID0gYXJncy5sZW5ndGggLSAxO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpID0gc3RhcnQ7XG4gICAgICB2YXIgcmVzdWx0ID0gYXJnc1tzdGFydF0uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHdoaWxlIChpLS0pIHJlc3VsdCA9IGFyZ3NbaV0uY2FsbCh0aGlzLCByZXN1bHQpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHdpbGwgb25seSBiZSBleGVjdXRlZCBvbiBhbmQgYWZ0ZXIgdGhlIE50aCBjYWxsLlxuICBfLmFmdGVyID0gZnVuY3Rpb24odGltZXMsIGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS10aW1lcyA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHdpbGwgb25seSBiZSBleGVjdXRlZCB1cCB0byAoYnV0IG5vdCBpbmNsdWRpbmcpIHRoZSBOdGggY2FsbC5cbiAgXy5iZWZvcmUgPSBmdW5jdGlvbih0aW1lcywgZnVuYykge1xuICAgIHZhciBtZW1vO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICgtLXRpbWVzID4gMCkge1xuICAgICAgICBtZW1vID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfVxuICAgICAgaWYgKHRpbWVzIDw9IDEpIGZ1bmMgPSBudWxsO1xuICAgICAgcmV0dXJuIG1lbW87XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGV4ZWN1dGVkIGF0IG1vc3Qgb25lIHRpbWUsIG5vIG1hdHRlciBob3dcbiAgLy8gb2Z0ZW4geW91IGNhbGwgaXQuIFVzZWZ1bCBmb3IgbGF6eSBpbml0aWFsaXphdGlvbi5cbiAgXy5vbmNlID0gXy5wYXJ0aWFsKF8uYmVmb3JlLCAyKTtcblxuICAvLyBPYmplY3QgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBLZXlzIGluIElFIDwgOSB0aGF0IHdvbid0IGJlIGl0ZXJhdGVkIGJ5IGBmb3Iga2V5IGluIC4uLmAgYW5kIHRodXMgbWlzc2VkLlxuICB2YXIgaGFzRW51bUJ1ZyA9ICF7dG9TdHJpbmc6IG51bGx9LnByb3BlcnR5SXNFbnVtZXJhYmxlKCd0b1N0cmluZycpO1xuICB2YXIgbm9uRW51bWVyYWJsZVByb3BzID0gWyd2YWx1ZU9mJywgJ2lzUHJvdG90eXBlT2YnLCAndG9TdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICdwcm9wZXJ0eUlzRW51bWVyYWJsZScsICdoYXNPd25Qcm9wZXJ0eScsICd0b0xvY2FsZVN0cmluZyddO1xuXG4gIGZ1bmN0aW9uIGNvbGxlY3ROb25FbnVtUHJvcHMob2JqLCBrZXlzKSB7XG4gICAgdmFyIG5vbkVudW1JZHggPSBub25FbnVtZXJhYmxlUHJvcHMubGVuZ3RoO1xuICAgIHZhciBjb25zdHJ1Y3RvciA9IG9iai5jb25zdHJ1Y3RvcjtcbiAgICB2YXIgcHJvdG8gPSAoXy5pc0Z1bmN0aW9uKGNvbnN0cnVjdG9yKSAmJiBjb25zdHJ1Y3Rvci5wcm90b3R5cGUpIHx8IE9ialByb3RvO1xuXG4gICAgLy8gQ29uc3RydWN0b3IgaXMgYSBzcGVjaWFsIGNhc2UuXG4gICAgdmFyIHByb3AgPSAnY29uc3RydWN0b3InO1xuICAgIGlmIChfLmhhcyhvYmosIHByb3ApICYmICFfLmNvbnRhaW5zKGtleXMsIHByb3ApKSBrZXlzLnB1c2gocHJvcCk7XG5cbiAgICB3aGlsZSAobm9uRW51bUlkeC0tKSB7XG4gICAgICBwcm9wID0gbm9uRW51bWVyYWJsZVByb3BzW25vbkVudW1JZHhdO1xuICAgICAgaWYgKHByb3AgaW4gb2JqICYmIG9ialtwcm9wXSAhPT0gcHJvdG9bcHJvcF0gJiYgIV8uY29udGFpbnMoa2V5cywgcHJvcCkpIHtcbiAgICAgICAga2V5cy5wdXNoKHByb3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFJldHJpZXZlIHRoZSBuYW1lcyBvZiBhbiBvYmplY3QncyBvd24gcHJvcGVydGllcy5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYE9iamVjdC5rZXlzYFxuICBfLmtleXMgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIV8uaXNPYmplY3Qob2JqKSkgcmV0dXJuIFtdO1xuICAgIGlmIChuYXRpdmVLZXlzKSByZXR1cm4gbmF0aXZlS2V5cyhvYmopO1xuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikgaWYgKF8uaGFzKG9iaiwga2V5KSkga2V5cy5wdXNoKGtleSk7XG4gICAgLy8gQWhlbSwgSUUgPCA5LlxuICAgIGlmIChoYXNFbnVtQnVnKSBjb2xsZWN0Tm9uRW51bVByb3BzKG9iaiwga2V5cyk7XG4gICAgcmV0dXJuIGtleXM7XG4gIH07XG5cbiAgLy8gUmV0cmlldmUgYWxsIHRoZSBwcm9wZXJ0eSBuYW1lcyBvZiBhbiBvYmplY3QuXG4gIF8uYWxsS2V5cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gW107XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBrZXlzLnB1c2goa2V5KTtcbiAgICAvLyBBaGVtLCBJRSA8IDkuXG4gICAgaWYgKGhhc0VudW1CdWcpIGNvbGxlY3ROb25FbnVtUHJvcHMob2JqLCBrZXlzKTtcbiAgICByZXR1cm4ga2V5cztcbiAgfTtcblxuICAvLyBSZXRyaWV2ZSB0aGUgdmFsdWVzIG9mIGFuIG9iamVjdCdzIHByb3BlcnRpZXMuXG4gIF8udmFsdWVzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICB2YXIgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgdmFyIHZhbHVlcyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFsdWVzW2ldID0gb2JqW2tleXNbaV1dO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzO1xuICB9O1xuXG4gIC8vIFJldHVybnMgdGhlIHJlc3VsdHMgb2YgYXBwbHlpbmcgdGhlIGl0ZXJhdGVlIHRvIGVhY2ggZWxlbWVudCBvZiB0aGUgb2JqZWN0XG4gIC8vIEluIGNvbnRyYXN0IHRvIF8ubWFwIGl0IHJldHVybnMgYW4gb2JqZWN0XG4gIF8ubWFwT2JqZWN0ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIGl0ZXJhdGVlID0gY2IoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgIHZhciBrZXlzID0gIF8ua2V5cyhvYmopLFxuICAgICAgICAgIGxlbmd0aCA9IGtleXMubGVuZ3RoLFxuICAgICAgICAgIHJlc3VsdHMgPSB7fSxcbiAgICAgICAgICBjdXJyZW50S2V5O1xuICAgICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBjdXJyZW50S2V5ID0ga2V5c1tpbmRleF07XG4gICAgICAgIHJlc3VsdHNbY3VycmVudEtleV0gPSBpdGVyYXRlZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0cztcbiAgfTtcblxuICAvLyBDb252ZXJ0IGFuIG9iamVjdCBpbnRvIGEgbGlzdCBvZiBgW2tleSwgdmFsdWVdYCBwYWlycy5cbiAgXy5wYWlycyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIHZhciBwYWlycyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgcGFpcnNbaV0gPSBba2V5c1tpXSwgb2JqW2tleXNbaV1dXTtcbiAgICB9XG4gICAgcmV0dXJuIHBhaXJzO1xuICB9O1xuXG4gIC8vIEludmVydCB0aGUga2V5cyBhbmQgdmFsdWVzIG9mIGFuIG9iamVjdC4gVGhlIHZhbHVlcyBtdXN0IGJlIHNlcmlhbGl6YWJsZS5cbiAgXy5pbnZlcnQgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0W29ialtrZXlzW2ldXV0gPSBrZXlzW2ldO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiBhIHNvcnRlZCBsaXN0IG9mIHRoZSBmdW5jdGlvbiBuYW1lcyBhdmFpbGFibGUgb24gdGhlIG9iamVjdC5cbiAgLy8gQWxpYXNlZCBhcyBgbWV0aG9kc2BcbiAgXy5mdW5jdGlvbnMgPSBfLm1ldGhvZHMgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgbmFtZXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICBpZiAoXy5pc0Z1bmN0aW9uKG9ialtrZXldKSkgbmFtZXMucHVzaChrZXkpO1xuICAgIH1cbiAgICByZXR1cm4gbmFtZXMuc29ydCgpO1xuICB9O1xuXG4gIC8vIEV4dGVuZCBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgcHJvcGVydGllcyBpbiBwYXNzZWQtaW4gb2JqZWN0KHMpLlxuICBfLmV4dGVuZCA9IGNyZWF0ZUFzc2lnbmVyKF8uYWxsS2V5cyk7XG5cbiAgLy8gQXNzaWducyBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgb3duIHByb3BlcnRpZXMgaW4gdGhlIHBhc3NlZC1pbiBvYmplY3QocylcbiAgLy8gKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL09iamVjdC9hc3NpZ24pXG4gIF8uZXh0ZW5kT3duID0gXy5hc3NpZ24gPSBjcmVhdGVBc3NpZ25lcihfLmtleXMpO1xuXG4gIC8vIFJldHVybnMgdGhlIGZpcnN0IGtleSBvbiBhbiBvYmplY3QgdGhhdCBwYXNzZXMgYSBwcmVkaWNhdGUgdGVzdFxuICBfLmZpbmRLZXkgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHByZWRpY2F0ZSA9IGNiKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKSwga2V5O1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBrZXlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBrZXkgPSBrZXlzW2ldO1xuICAgICAgaWYgKHByZWRpY2F0ZShvYmpba2V5XSwga2V5LCBvYmopKSByZXR1cm4ga2V5O1xuICAgIH1cbiAgfTtcblxuICAvLyBSZXR1cm4gYSBjb3B5IG9mIHRoZSBvYmplY3Qgb25seSBjb250YWluaW5nIHRoZSB3aGl0ZWxpc3RlZCBwcm9wZXJ0aWVzLlxuICBfLnBpY2sgPSBmdW5jdGlvbihvYmplY3QsIG9pdGVyYXRlZSwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHQgPSB7fSwgb2JqID0gb2JqZWN0LCBpdGVyYXRlZSwga2V5cztcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHQ7XG4gICAgaWYgKF8uaXNGdW5jdGlvbihvaXRlcmF0ZWUpKSB7XG4gICAgICBrZXlzID0gXy5hbGxLZXlzKG9iaik7XG4gICAgICBpdGVyYXRlZSA9IG9wdGltaXplQ2Iob2l0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAga2V5cyA9IGZsYXR0ZW4oYXJndW1lbnRzLCBmYWxzZSwgZmFsc2UsIDEpO1xuICAgICAgaXRlcmF0ZWUgPSBmdW5jdGlvbih2YWx1ZSwga2V5LCBvYmopIHsgcmV0dXJuIGtleSBpbiBvYmo7IH07XG4gICAgICBvYmogPSBPYmplY3Qob2JqKTtcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgICAgdmFyIHZhbHVlID0gb2JqW2tleV07XG4gICAgICBpZiAoaXRlcmF0ZWUodmFsdWUsIGtleSwgb2JqKSkgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAgLy8gUmV0dXJuIGEgY29weSBvZiB0aGUgb2JqZWN0IHdpdGhvdXQgdGhlIGJsYWNrbGlzdGVkIHByb3BlcnRpZXMuXG4gIF8ub21pdCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpZiAoXy5pc0Z1bmN0aW9uKGl0ZXJhdGVlKSkge1xuICAgICAgaXRlcmF0ZWUgPSBfLm5lZ2F0ZShpdGVyYXRlZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBrZXlzID0gXy5tYXAoZmxhdHRlbihhcmd1bWVudHMsIGZhbHNlLCBmYWxzZSwgMSksIFN0cmluZyk7XG4gICAgICBpdGVyYXRlZSA9IGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgcmV0dXJuICFfLmNvbnRhaW5zKGtleXMsIGtleSk7XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gXy5waWNrKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpO1xuICB9O1xuXG4gIC8vIEZpbGwgaW4gYSBnaXZlbiBvYmplY3Qgd2l0aCBkZWZhdWx0IHByb3BlcnRpZXMuXG4gIF8uZGVmYXVsdHMgPSBjcmVhdGVBc3NpZ25lcihfLmFsbEtleXMsIHRydWUpO1xuXG4gIC8vIENyZWF0ZXMgYW4gb2JqZWN0IHRoYXQgaW5oZXJpdHMgZnJvbSB0aGUgZ2l2ZW4gcHJvdG90eXBlIG9iamVjdC5cbiAgLy8gSWYgYWRkaXRpb25hbCBwcm9wZXJ0aWVzIGFyZSBwcm92aWRlZCB0aGVuIHRoZXkgd2lsbCBiZSBhZGRlZCB0byB0aGVcbiAgLy8gY3JlYXRlZCBvYmplY3QuXG4gIF8uY3JlYXRlID0gZnVuY3Rpb24ocHJvdG90eXBlLCBwcm9wcykge1xuICAgIHZhciByZXN1bHQgPSBiYXNlQ3JlYXRlKHByb3RvdHlwZSk7XG4gICAgaWYgKHByb3BzKSBfLmV4dGVuZE93bihyZXN1bHQsIHByb3BzKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIENyZWF0ZSBhIChzaGFsbG93LWNsb25lZCkgZHVwbGljYXRlIG9mIGFuIG9iamVjdC5cbiAgXy5jbG9uZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIHJldHVybiBfLmlzQXJyYXkob2JqKSA/IG9iai5zbGljZSgpIDogXy5leHRlbmQoe30sIG9iaik7XG4gIH07XG5cbiAgLy8gSW52b2tlcyBpbnRlcmNlcHRvciB3aXRoIHRoZSBvYmosIGFuZCB0aGVuIHJldHVybnMgb2JqLlxuICAvLyBUaGUgcHJpbWFyeSBwdXJwb3NlIG9mIHRoaXMgbWV0aG9kIGlzIHRvIFwidGFwIGludG9cIiBhIG1ldGhvZCBjaGFpbiwgaW5cbiAgLy8gb3JkZXIgdG8gcGVyZm9ybSBvcGVyYXRpb25zIG9uIGludGVybWVkaWF0ZSByZXN1bHRzIHdpdGhpbiB0aGUgY2hhaW4uXG4gIF8udGFwID0gZnVuY3Rpb24ob2JqLCBpbnRlcmNlcHRvcikge1xuICAgIGludGVyY2VwdG9yKG9iaik7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBSZXR1cm5zIHdoZXRoZXIgYW4gb2JqZWN0IGhhcyBhIGdpdmVuIHNldCBvZiBga2V5OnZhbHVlYCBwYWlycy5cbiAgXy5pc01hdGNoID0gZnVuY3Rpb24ob2JqZWN0LCBhdHRycykge1xuICAgIHZhciBrZXlzID0gXy5rZXlzKGF0dHJzKSwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgaWYgKG9iamVjdCA9PSBudWxsKSByZXR1cm4gIWxlbmd0aDtcbiAgICB2YXIgb2JqID0gT2JqZWN0KG9iamVjdCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgICBpZiAoYXR0cnNba2V5XSAhPT0gb2JqW2tleV0gfHwgIShrZXkgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuXG4gIC8vIEludGVybmFsIHJlY3Vyc2l2ZSBjb21wYXJpc29uIGZ1bmN0aW9uIGZvciBgaXNFcXVhbGAuXG4gIHZhciBlcSA9IGZ1bmN0aW9uKGEsIGIsIGFTdGFjaywgYlN0YWNrKSB7XG4gICAgLy8gSWRlbnRpY2FsIG9iamVjdHMgYXJlIGVxdWFsLiBgMCA9PT0gLTBgLCBidXQgdGhleSBhcmVuJ3QgaWRlbnRpY2FsLlxuICAgIC8vIFNlZSB0aGUgW0hhcm1vbnkgYGVnYWxgIHByb3Bvc2FsXShodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OmVnYWwpLlxuICAgIGlmIChhID09PSBiKSByZXR1cm4gYSAhPT0gMCB8fCAxIC8gYSA9PT0gMSAvIGI7XG4gICAgLy8gQSBzdHJpY3QgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnkgYmVjYXVzZSBgbnVsbCA9PSB1bmRlZmluZWRgLlxuICAgIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gYSA9PT0gYjtcbiAgICAvLyBVbndyYXAgYW55IHdyYXBwZWQgb2JqZWN0cy5cbiAgICBpZiAoYSBpbnN0YW5jZW9mIF8pIGEgPSBhLl93cmFwcGVkO1xuICAgIGlmIChiIGluc3RhbmNlb2YgXykgYiA9IGIuX3dyYXBwZWQ7XG4gICAgLy8gQ29tcGFyZSBgW1tDbGFzc11dYCBuYW1lcy5cbiAgICB2YXIgY2xhc3NOYW1lID0gdG9TdHJpbmcuY2FsbChhKTtcbiAgICBpZiAoY2xhc3NOYW1lICE9PSB0b1N0cmluZy5jYWxsKGIpKSByZXR1cm4gZmFsc2U7XG4gICAgc3dpdGNoIChjbGFzc05hbWUpIHtcbiAgICAgIC8vIFN0cmluZ3MsIG51bWJlcnMsIHJlZ3VsYXIgZXhwcmVzc2lvbnMsIGRhdGVzLCBhbmQgYm9vbGVhbnMgYXJlIGNvbXBhcmVkIGJ5IHZhbHVlLlxuICAgICAgY2FzZSAnW29iamVjdCBSZWdFeHBdJzpcbiAgICAgIC8vIFJlZ0V4cHMgYXJlIGNvZXJjZWQgdG8gc3RyaW5ncyBmb3IgY29tcGFyaXNvbiAoTm90ZTogJycgKyAvYS9pID09PSAnL2EvaScpXG4gICAgICBjYXNlICdbb2JqZWN0IFN0cmluZ10nOlxuICAgICAgICAvLyBQcmltaXRpdmVzIGFuZCB0aGVpciBjb3JyZXNwb25kaW5nIG9iamVjdCB3cmFwcGVycyBhcmUgZXF1aXZhbGVudDsgdGh1cywgYFwiNVwiYCBpc1xuICAgICAgICAvLyBlcXVpdmFsZW50IHRvIGBuZXcgU3RyaW5nKFwiNVwiKWAuXG4gICAgICAgIHJldHVybiAnJyArIGEgPT09ICcnICsgYjtcbiAgICAgIGNhc2UgJ1tvYmplY3QgTnVtYmVyXSc6XG4gICAgICAgIC8vIGBOYU5gcyBhcmUgZXF1aXZhbGVudCwgYnV0IG5vbi1yZWZsZXhpdmUuXG4gICAgICAgIC8vIE9iamVjdChOYU4pIGlzIGVxdWl2YWxlbnQgdG8gTmFOXG4gICAgICAgIGlmICgrYSAhPT0gK2EpIHJldHVybiArYiAhPT0gK2I7XG4gICAgICAgIC8vIEFuIGBlZ2FsYCBjb21wYXJpc29uIGlzIHBlcmZvcm1lZCBmb3Igb3RoZXIgbnVtZXJpYyB2YWx1ZXMuXG4gICAgICAgIHJldHVybiArYSA9PT0gMCA/IDEgLyArYSA9PT0gMSAvIGIgOiArYSA9PT0gK2I7XG4gICAgICBjYXNlICdbb2JqZWN0IERhdGVdJzpcbiAgICAgIGNhc2UgJ1tvYmplY3QgQm9vbGVhbl0nOlxuICAgICAgICAvLyBDb2VyY2UgZGF0ZXMgYW5kIGJvb2xlYW5zIHRvIG51bWVyaWMgcHJpbWl0aXZlIHZhbHVlcy4gRGF0ZXMgYXJlIGNvbXBhcmVkIGJ5IHRoZWlyXG4gICAgICAgIC8vIG1pbGxpc2Vjb25kIHJlcHJlc2VudGF0aW9ucy4gTm90ZSB0aGF0IGludmFsaWQgZGF0ZXMgd2l0aCBtaWxsaXNlY29uZCByZXByZXNlbnRhdGlvbnNcbiAgICAgICAgLy8gb2YgYE5hTmAgYXJlIG5vdCBlcXVpdmFsZW50LlxuICAgICAgICByZXR1cm4gK2EgPT09ICtiO1xuICAgIH1cblxuICAgIHZhciBhcmVBcnJheXMgPSBjbGFzc05hbWUgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgaWYgKCFhcmVBcnJheXMpIHtcbiAgICAgIGlmICh0eXBlb2YgYSAhPSAnb2JqZWN0JyB8fCB0eXBlb2YgYiAhPSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAvLyBPYmplY3RzIHdpdGggZGlmZmVyZW50IGNvbnN0cnVjdG9ycyBhcmUgbm90IGVxdWl2YWxlbnQsIGJ1dCBgT2JqZWN0YHMgb3IgYEFycmF5YHNcbiAgICAgIC8vIGZyb20gZGlmZmVyZW50IGZyYW1lcyBhcmUuXG4gICAgICB2YXIgYUN0b3IgPSBhLmNvbnN0cnVjdG9yLCBiQ3RvciA9IGIuY29uc3RydWN0b3I7XG4gICAgICBpZiAoYUN0b3IgIT09IGJDdG9yICYmICEoXy5pc0Z1bmN0aW9uKGFDdG9yKSAmJiBhQ3RvciBpbnN0YW5jZW9mIGFDdG9yICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5pc0Z1bmN0aW9uKGJDdG9yKSAmJiBiQ3RvciBpbnN0YW5jZW9mIGJDdG9yKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAmJiAoJ2NvbnN0cnVjdG9yJyBpbiBhICYmICdjb25zdHJ1Y3RvcicgaW4gYikpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBBc3N1bWUgZXF1YWxpdHkgZm9yIGN5Y2xpYyBzdHJ1Y3R1cmVzLiBUaGUgYWxnb3JpdGhtIGZvciBkZXRlY3RpbmcgY3ljbGljXG4gICAgLy8gc3RydWN0dXJlcyBpcyBhZGFwdGVkIGZyb20gRVMgNS4xIHNlY3Rpb24gMTUuMTIuMywgYWJzdHJhY3Qgb3BlcmF0aW9uIGBKT2AuXG5cbiAgICAvLyBJbml0aWFsaXppbmcgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gICAgLy8gSXQncyBkb25lIGhlcmUgc2luY2Ugd2Ugb25seSBuZWVkIHRoZW0gZm9yIG9iamVjdHMgYW5kIGFycmF5cyBjb21wYXJpc29uLlxuICAgIGFTdGFjayA9IGFTdGFjayB8fCBbXTtcbiAgICBiU3RhY2sgPSBiU3RhY2sgfHwgW107XG4gICAgdmFyIGxlbmd0aCA9IGFTdGFjay5sZW5ndGg7XG4gICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICAvLyBMaW5lYXIgc2VhcmNoLiBQZXJmb3JtYW5jZSBpcyBpbnZlcnNlbHkgcHJvcG9ydGlvbmFsIHRvIHRoZSBudW1iZXIgb2ZcbiAgICAgIC8vIHVuaXF1ZSBuZXN0ZWQgc3RydWN0dXJlcy5cbiAgICAgIGlmIChhU3RhY2tbbGVuZ3RoXSA9PT0gYSkgcmV0dXJuIGJTdGFja1tsZW5ndGhdID09PSBiO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgZmlyc3Qgb2JqZWN0IHRvIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0cy5cbiAgICBhU3RhY2sucHVzaChhKTtcbiAgICBiU3RhY2sucHVzaChiKTtcblxuICAgIC8vIFJlY3Vyc2l2ZWx5IGNvbXBhcmUgb2JqZWN0cyBhbmQgYXJyYXlzLlxuICAgIGlmIChhcmVBcnJheXMpIHtcbiAgICAgIC8vIENvbXBhcmUgYXJyYXkgbGVuZ3RocyB0byBkZXRlcm1pbmUgaWYgYSBkZWVwIGNvbXBhcmlzb24gaXMgbmVjZXNzYXJ5LlxuICAgICAgbGVuZ3RoID0gYS5sZW5ndGg7XG4gICAgICBpZiAobGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICAgICAgLy8gRGVlcCBjb21wYXJlIHRoZSBjb250ZW50cywgaWdub3Jpbmcgbm9uLW51bWVyaWMgcHJvcGVydGllcy5cbiAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICBpZiAoIWVxKGFbbGVuZ3RoXSwgYltsZW5ndGhdLCBhU3RhY2ssIGJTdGFjaykpIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGVlcCBjb21wYXJlIG9iamVjdHMuXG4gICAgICB2YXIga2V5cyA9IF8ua2V5cyhhKSwga2V5O1xuICAgICAgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgICAvLyBFbnN1cmUgdGhhdCBib3RoIG9iamVjdHMgY29udGFpbiB0aGUgc2FtZSBudW1iZXIgb2YgcHJvcGVydGllcyBiZWZvcmUgY29tcGFyaW5nIGRlZXAgZXF1YWxpdHkuXG4gICAgICBpZiAoXy5rZXlzKGIpLmxlbmd0aCAhPT0gbGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgICAgLy8gRGVlcCBjb21wYXJlIGVhY2ggbWVtYmVyXG4gICAgICAgIGtleSA9IGtleXNbbGVuZ3RoXTtcbiAgICAgICAgaWYgKCEoXy5oYXMoYiwga2V5KSAmJiBlcShhW2tleV0sIGJba2V5XSwgYVN0YWNrLCBiU3RhY2spKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBSZW1vdmUgdGhlIGZpcnN0IG9iamVjdCBmcm9tIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0cy5cbiAgICBhU3RhY2sucG9wKCk7XG4gICAgYlN0YWNrLnBvcCgpO1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8vIFBlcmZvcm0gYSBkZWVwIGNvbXBhcmlzb24gdG8gY2hlY2sgaWYgdHdvIG9iamVjdHMgYXJlIGVxdWFsLlxuICBfLmlzRXF1YWwgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgcmV0dXJuIGVxKGEsIGIpO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gYXJyYXksIHN0cmluZywgb3Igb2JqZWN0IGVtcHR5P1xuICAvLyBBbiBcImVtcHR5XCIgb2JqZWN0IGhhcyBubyBlbnVtZXJhYmxlIG93bi1wcm9wZXJ0aWVzLlxuICBfLmlzRW1wdHkgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIGlmIChpc0FycmF5TGlrZShvYmopICYmIChfLmlzQXJyYXkob2JqKSB8fCBfLmlzU3RyaW5nKG9iaikgfHwgXy5pc0FyZ3VtZW50cyhvYmopKSkgcmV0dXJuIG9iai5sZW5ndGggPT09IDA7XG4gICAgcmV0dXJuIF8ua2V5cyhvYmopLmxlbmd0aCA9PT0gMDtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGEgRE9NIGVsZW1lbnQ/XG4gIF8uaXNFbGVtZW50ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuICEhKG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDEpO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYW4gYXJyYXk/XG4gIC8vIERlbGVnYXRlcyB0byBFQ01BNSdzIG5hdGl2ZSBBcnJheS5pc0FycmF5XG4gIF8uaXNBcnJheSA9IG5hdGl2ZUlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhcmlhYmxlIGFuIG9iamVjdD9cbiAgXy5pc09iamVjdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciB0eXBlID0gdHlwZW9mIG9iajtcbiAgICByZXR1cm4gdHlwZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlID09PSAnb2JqZWN0JyAmJiAhIW9iajtcbiAgfTtcblxuICAvLyBBZGQgc29tZSBpc1R5cGUgbWV0aG9kczogaXNBcmd1bWVudHMsIGlzRnVuY3Rpb24sIGlzU3RyaW5nLCBpc051bWJlciwgaXNEYXRlLCBpc1JlZ0V4cCwgaXNFcnJvci5cbiAgXy5lYWNoKFsnQXJndW1lbnRzJywgJ0Z1bmN0aW9uJywgJ1N0cmluZycsICdOdW1iZXInLCAnRGF0ZScsICdSZWdFeHAnLCAnRXJyb3InXSwgZnVuY3Rpb24obmFtZSkge1xuICAgIF9bJ2lzJyArIG5hbWVdID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCAnICsgbmFtZSArICddJztcbiAgICB9O1xuICB9KTtcblxuICAvLyBEZWZpbmUgYSBmYWxsYmFjayB2ZXJzaW9uIG9mIHRoZSBtZXRob2QgaW4gYnJvd3NlcnMgKGFoZW0sIElFIDwgOSksIHdoZXJlXG4gIC8vIHRoZXJlIGlzbid0IGFueSBpbnNwZWN0YWJsZSBcIkFyZ3VtZW50c1wiIHR5cGUuXG4gIGlmICghXy5pc0FyZ3VtZW50cyhhcmd1bWVudHMpKSB7XG4gICAgXy5pc0FyZ3VtZW50cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIF8uaGFzKG9iaiwgJ2NhbGxlZScpO1xuICAgIH07XG4gIH1cblxuICAvLyBPcHRpbWl6ZSBgaXNGdW5jdGlvbmAgaWYgYXBwcm9wcmlhdGUuIFdvcmsgYXJvdW5kIHNvbWUgdHlwZW9mIGJ1Z3MgaW4gb2xkIHY4LFxuICAvLyBJRSAxMSAoIzE2MjEpLCBhbmQgaW4gU2FmYXJpIDggKCMxOTI5KS5cbiAgaWYgKHR5cGVvZiAvLi8gIT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgSW50OEFycmF5ICE9ICdvYmplY3QnKSB7XG4gICAgXy5pc0Z1bmN0aW9uID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PSAnZnVuY3Rpb24nIHx8IGZhbHNlO1xuICAgIH07XG4gIH1cblxuICAvLyBJcyBhIGdpdmVuIG9iamVjdCBhIGZpbml0ZSBudW1iZXI/XG4gIF8uaXNGaW5pdGUgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gaXNGaW5pdGUob2JqKSAmJiAhaXNOYU4ocGFyc2VGbG9hdChvYmopKTtcbiAgfTtcblxuICAvLyBJcyB0aGUgZ2l2ZW4gdmFsdWUgYE5hTmA/IChOYU4gaXMgdGhlIG9ubHkgbnVtYmVyIHdoaWNoIGRvZXMgbm90IGVxdWFsIGl0c2VsZikuXG4gIF8uaXNOYU4gPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gXy5pc051bWJlcihvYmopICYmIG9iaiAhPT0gK29iajtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGEgYm9vbGVhbj9cbiAgXy5pc0Jvb2xlYW4gPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSB0cnVlIHx8IG9iaiA9PT0gZmFsc2UgfHwgdG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBCb29sZWFuXSc7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBlcXVhbCB0byBudWxsP1xuICBfLmlzTnVsbCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IG51bGw7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YXJpYWJsZSB1bmRlZmluZWQ/XG4gIF8uaXNVbmRlZmluZWQgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSB2b2lkIDA7XG4gIH07XG5cbiAgLy8gU2hvcnRjdXQgZnVuY3Rpb24gZm9yIGNoZWNraW5nIGlmIGFuIG9iamVjdCBoYXMgYSBnaXZlbiBwcm9wZXJ0eSBkaXJlY3RseVxuICAvLyBvbiBpdHNlbGYgKGluIG90aGVyIHdvcmRzLCBub3Qgb24gYSBwcm90b3R5cGUpLlxuICBfLmhhcyA9IGZ1bmN0aW9uKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIG9iaiAhPSBudWxsICYmIGhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpO1xuICB9O1xuXG4gIC8vIFV0aWxpdHkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gUnVuIFVuZGVyc2NvcmUuanMgaW4gKm5vQ29uZmxpY3QqIG1vZGUsIHJldHVybmluZyB0aGUgYF9gIHZhcmlhYmxlIHRvIGl0c1xuICAvLyBwcmV2aW91cyBvd25lci4gUmV0dXJucyBhIHJlZmVyZW5jZSB0byB0aGUgVW5kZXJzY29yZSBvYmplY3QuXG4gIF8ubm9Db25mbGljdCA9IGZ1bmN0aW9uKCkge1xuICAgIHJvb3QuXyA9IHByZXZpb3VzVW5kZXJzY29yZTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvLyBLZWVwIHRoZSBpZGVudGl0eSBmdW5jdGlvbiBhcm91bmQgZm9yIGRlZmF1bHQgaXRlcmF0ZWVzLlxuICBfLmlkZW50aXR5ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgLy8gUHJlZGljYXRlLWdlbmVyYXRpbmcgZnVuY3Rpb25zLiBPZnRlbiB1c2VmdWwgb3V0c2lkZSBvZiBVbmRlcnNjb3JlLlxuICBfLmNvbnN0YW50ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcbiAgfTtcblxuICBfLm5vb3AgPSBmdW5jdGlvbigpe307XG5cbiAgXy5wcm9wZXJ0eSA9IHByb3BlcnR5O1xuXG4gIC8vIEdlbmVyYXRlcyBhIGZ1bmN0aW9uIGZvciBhIGdpdmVuIG9iamVjdCB0aGF0IHJldHVybnMgYSBnaXZlbiBwcm9wZXJ0eS5cbiAgXy5wcm9wZXJ0eU9mID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PSBudWxsID8gZnVuY3Rpb24oKXt9IDogZnVuY3Rpb24oa2V5KSB7XG4gICAgICByZXR1cm4gb2JqW2tleV07XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgcHJlZGljYXRlIGZvciBjaGVja2luZyB3aGV0aGVyIGFuIG9iamVjdCBoYXMgYSBnaXZlbiBzZXQgb2ZcbiAgLy8gYGtleTp2YWx1ZWAgcGFpcnMuXG4gIF8ubWF0Y2hlciA9IF8ubWF0Y2hlcyA9IGZ1bmN0aW9uKGF0dHJzKSB7XG4gICAgYXR0cnMgPSBfLmV4dGVuZE93bih7fSwgYXR0cnMpO1xuICAgIHJldHVybiBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBfLmlzTWF0Y2gob2JqLCBhdHRycyk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBSdW4gYSBmdW5jdGlvbiAqKm4qKiB0aW1lcy5cbiAgXy50aW1lcyA9IGZ1bmN0aW9uKG4sIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIGFjY3VtID0gQXJyYXkoTWF0aC5tYXgoMCwgbikpO1xuICAgIGl0ZXJhdGVlID0gb3B0aW1pemVDYihpdGVyYXRlZSwgY29udGV4dCwgMSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIGFjY3VtW2ldID0gaXRlcmF0ZWUoaSk7XG4gICAgcmV0dXJuIGFjY3VtO1xuICB9O1xuXG4gIC8vIFJldHVybiBhIHJhbmRvbSBpbnRlZ2VyIGJldHdlZW4gbWluIGFuZCBtYXggKGluY2x1c2l2ZSkuXG4gIF8ucmFuZG9tID0gZnVuY3Rpb24obWluLCBtYXgpIHtcbiAgICBpZiAobWF4ID09IG51bGwpIHtcbiAgICAgIG1heCA9IG1pbjtcbiAgICAgIG1pbiA9IDA7XG4gICAgfVxuICAgIHJldHVybiBtaW4gKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluICsgMSkpO1xuICB9O1xuXG4gIC8vIEEgKHBvc3NpYmx5IGZhc3Rlcikgd2F5IHRvIGdldCB0aGUgY3VycmVudCB0aW1lc3RhbXAgYXMgYW4gaW50ZWdlci5cbiAgXy5ub3cgPSBEYXRlLm5vdyB8fCBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gIH07XG5cbiAgIC8vIExpc3Qgb2YgSFRNTCBlbnRpdGllcyBmb3IgZXNjYXBpbmcuXG4gIHZhciBlc2NhcGVNYXAgPSB7XG4gICAgJyYnOiAnJmFtcDsnLFxuICAgICc8JzogJyZsdDsnLFxuICAgICc+JzogJyZndDsnLFxuICAgICdcIic6ICcmcXVvdDsnLFxuICAgIFwiJ1wiOiAnJiN4Mjc7JyxcbiAgICAnYCc6ICcmI3g2MDsnXG4gIH07XG4gIHZhciB1bmVzY2FwZU1hcCA9IF8uaW52ZXJ0KGVzY2FwZU1hcCk7XG5cbiAgLy8gRnVuY3Rpb25zIGZvciBlc2NhcGluZyBhbmQgdW5lc2NhcGluZyBzdHJpbmdzIHRvL2Zyb20gSFRNTCBpbnRlcnBvbGF0aW9uLlxuICB2YXIgY3JlYXRlRXNjYXBlciA9IGZ1bmN0aW9uKG1hcCkge1xuICAgIHZhciBlc2NhcGVyID0gZnVuY3Rpb24obWF0Y2gpIHtcbiAgICAgIHJldHVybiBtYXBbbWF0Y2hdO1xuICAgIH07XG4gICAgLy8gUmVnZXhlcyBmb3IgaWRlbnRpZnlpbmcgYSBrZXkgdGhhdCBuZWVkcyB0byBiZSBlc2NhcGVkXG4gICAgdmFyIHNvdXJjZSA9ICcoPzonICsgXy5rZXlzKG1hcCkuam9pbignfCcpICsgJyknO1xuICAgIHZhciB0ZXN0UmVnZXhwID0gUmVnRXhwKHNvdXJjZSk7XG4gICAgdmFyIHJlcGxhY2VSZWdleHAgPSBSZWdFeHAoc291cmNlLCAnZycpO1xuICAgIHJldHVybiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgIHN0cmluZyA9IHN0cmluZyA9PSBudWxsID8gJycgOiAnJyArIHN0cmluZztcbiAgICAgIHJldHVybiB0ZXN0UmVnZXhwLnRlc3Qoc3RyaW5nKSA/IHN0cmluZy5yZXBsYWNlKHJlcGxhY2VSZWdleHAsIGVzY2FwZXIpIDogc3RyaW5nO1xuICAgIH07XG4gIH07XG4gIF8uZXNjYXBlID0gY3JlYXRlRXNjYXBlcihlc2NhcGVNYXApO1xuICBfLnVuZXNjYXBlID0gY3JlYXRlRXNjYXBlcih1bmVzY2FwZU1hcCk7XG5cbiAgLy8gSWYgdGhlIHZhbHVlIG9mIHRoZSBuYW1lZCBgcHJvcGVydHlgIGlzIGEgZnVuY3Rpb24gdGhlbiBpbnZva2UgaXQgd2l0aCB0aGVcbiAgLy8gYG9iamVjdGAgYXMgY29udGV4dDsgb3RoZXJ3aXNlLCByZXR1cm4gaXQuXG4gIF8ucmVzdWx0ID0gZnVuY3Rpb24ob2JqZWN0LCBwcm9wZXJ0eSwgZmFsbGJhY2spIHtcbiAgICB2YXIgdmFsdWUgPSBvYmplY3QgPT0gbnVsbCA/IHZvaWQgMCA6IG9iamVjdFtwcm9wZXJ0eV07XG4gICAgaWYgKHZhbHVlID09PSB2b2lkIDApIHtcbiAgICAgIHZhbHVlID0gZmFsbGJhY2s7XG4gICAgfVxuICAgIHJldHVybiBfLmlzRnVuY3Rpb24odmFsdWUpID8gdmFsdWUuY2FsbChvYmplY3QpIDogdmFsdWU7XG4gIH07XG5cbiAgLy8gR2VuZXJhdGUgYSB1bmlxdWUgaW50ZWdlciBpZCAodW5pcXVlIHdpdGhpbiB0aGUgZW50aXJlIGNsaWVudCBzZXNzaW9uKS5cbiAgLy8gVXNlZnVsIGZvciB0ZW1wb3JhcnkgRE9NIGlkcy5cbiAgdmFyIGlkQ291bnRlciA9IDA7XG4gIF8udW5pcXVlSWQgPSBmdW5jdGlvbihwcmVmaXgpIHtcbiAgICB2YXIgaWQgPSArK2lkQ291bnRlciArICcnO1xuICAgIHJldHVybiBwcmVmaXggPyBwcmVmaXggKyBpZCA6IGlkO1xuICB9O1xuXG4gIC8vIEJ5IGRlZmF1bHQsIFVuZGVyc2NvcmUgdXNlcyBFUkItc3R5bGUgdGVtcGxhdGUgZGVsaW1pdGVycywgY2hhbmdlIHRoZVxuICAvLyBmb2xsb3dpbmcgdGVtcGxhdGUgc2V0dGluZ3MgdG8gdXNlIGFsdGVybmF0aXZlIGRlbGltaXRlcnMuXG4gIF8udGVtcGxhdGVTZXR0aW5ncyA9IHtcbiAgICBldmFsdWF0ZSAgICA6IC88JShbXFxzXFxTXSs/KSU+L2csXG4gICAgaW50ZXJwb2xhdGUgOiAvPCU9KFtcXHNcXFNdKz8pJT4vZyxcbiAgICBlc2NhcGUgICAgICA6IC88JS0oW1xcc1xcU10rPyklPi9nXG4gIH07XG5cbiAgLy8gV2hlbiBjdXN0b21pemluZyBgdGVtcGxhdGVTZXR0aW5nc2AsIGlmIHlvdSBkb24ndCB3YW50IHRvIGRlZmluZSBhblxuICAvLyBpbnRlcnBvbGF0aW9uLCBldmFsdWF0aW9uIG9yIGVzY2FwaW5nIHJlZ2V4LCB3ZSBuZWVkIG9uZSB0aGF0IGlzXG4gIC8vIGd1YXJhbnRlZWQgbm90IHRvIG1hdGNoLlxuICB2YXIgbm9NYXRjaCA9IC8oLileLztcblxuICAvLyBDZXJ0YWluIGNoYXJhY3RlcnMgbmVlZCB0byBiZSBlc2NhcGVkIHNvIHRoYXQgdGhleSBjYW4gYmUgcHV0IGludG8gYVxuICAvLyBzdHJpbmcgbGl0ZXJhbC5cbiAgdmFyIGVzY2FwZXMgPSB7XG4gICAgXCInXCI6ICAgICAgXCInXCIsXG4gICAgJ1xcXFwnOiAgICAgJ1xcXFwnLFxuICAgICdcXHInOiAgICAgJ3InLFxuICAgICdcXG4nOiAgICAgJ24nLFxuICAgICdcXHUyMDI4JzogJ3UyMDI4JyxcbiAgICAnXFx1MjAyOSc6ICd1MjAyOSdcbiAgfTtcblxuICB2YXIgZXNjYXBlciA9IC9cXFxcfCd8XFxyfFxcbnxcXHUyMDI4fFxcdTIwMjkvZztcblxuICB2YXIgZXNjYXBlQ2hhciA9IGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgcmV0dXJuICdcXFxcJyArIGVzY2FwZXNbbWF0Y2hdO1xuICB9O1xuXG4gIC8vIEphdmFTY3JpcHQgbWljcm8tdGVtcGxhdGluZywgc2ltaWxhciB0byBKb2huIFJlc2lnJ3MgaW1wbGVtZW50YXRpb24uXG4gIC8vIFVuZGVyc2NvcmUgdGVtcGxhdGluZyBoYW5kbGVzIGFyYml0cmFyeSBkZWxpbWl0ZXJzLCBwcmVzZXJ2ZXMgd2hpdGVzcGFjZSxcbiAgLy8gYW5kIGNvcnJlY3RseSBlc2NhcGVzIHF1b3RlcyB3aXRoaW4gaW50ZXJwb2xhdGVkIGNvZGUuXG4gIC8vIE5COiBgb2xkU2V0dGluZ3NgIG9ubHkgZXhpc3RzIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eS5cbiAgXy50ZW1wbGF0ZSA9IGZ1bmN0aW9uKHRleHQsIHNldHRpbmdzLCBvbGRTZXR0aW5ncykge1xuICAgIGlmICghc2V0dGluZ3MgJiYgb2xkU2V0dGluZ3MpIHNldHRpbmdzID0gb2xkU2V0dGluZ3M7XG4gICAgc2V0dGluZ3MgPSBfLmRlZmF1bHRzKHt9LCBzZXR0aW5ncywgXy50ZW1wbGF0ZVNldHRpbmdzKTtcblxuICAgIC8vIENvbWJpbmUgZGVsaW1pdGVycyBpbnRvIG9uZSByZWd1bGFyIGV4cHJlc3Npb24gdmlhIGFsdGVybmF0aW9uLlxuICAgIHZhciBtYXRjaGVyID0gUmVnRXhwKFtcbiAgICAgIChzZXR0aW5ncy5lc2NhcGUgfHwgbm9NYXRjaCkuc291cmNlLFxuICAgICAgKHNldHRpbmdzLmludGVycG9sYXRlIHx8IG5vTWF0Y2gpLnNvdXJjZSxcbiAgICAgIChzZXR0aW5ncy5ldmFsdWF0ZSB8fCBub01hdGNoKS5zb3VyY2VcbiAgICBdLmpvaW4oJ3wnKSArICd8JCcsICdnJyk7XG5cbiAgICAvLyBDb21waWxlIHRoZSB0ZW1wbGF0ZSBzb3VyY2UsIGVzY2FwaW5nIHN0cmluZyBsaXRlcmFscyBhcHByb3ByaWF0ZWx5LlxuICAgIHZhciBpbmRleCA9IDA7XG4gICAgdmFyIHNvdXJjZSA9IFwiX19wKz0nXCI7XG4gICAgdGV4dC5yZXBsYWNlKG1hdGNoZXIsIGZ1bmN0aW9uKG1hdGNoLCBlc2NhcGUsIGludGVycG9sYXRlLCBldmFsdWF0ZSwgb2Zmc2V0KSB7XG4gICAgICBzb3VyY2UgKz0gdGV4dC5zbGljZShpbmRleCwgb2Zmc2V0KS5yZXBsYWNlKGVzY2FwZXIsIGVzY2FwZUNoYXIpO1xuICAgICAgaW5kZXggPSBvZmZzZXQgKyBtYXRjaC5sZW5ndGg7XG5cbiAgICAgIGlmIChlc2NhcGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJytcXG4oKF9fdD0oXCIgKyBlc2NhcGUgKyBcIikpPT1udWxsPycnOl8uZXNjYXBlKF9fdCkpK1xcbidcIjtcbiAgICAgIH0gZWxzZSBpZiAoaW50ZXJwb2xhdGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJytcXG4oKF9fdD0oXCIgKyBpbnRlcnBvbGF0ZSArIFwiKSk9PW51bGw/Jyc6X190KStcXG4nXCI7XG4gICAgICB9IGVsc2UgaWYgKGV2YWx1YXRlKSB7XG4gICAgICAgIHNvdXJjZSArPSBcIic7XFxuXCIgKyBldmFsdWF0ZSArIFwiXFxuX19wKz0nXCI7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkb2JlIFZNcyBuZWVkIHRoZSBtYXRjaCByZXR1cm5lZCB0byBwcm9kdWNlIHRoZSBjb3JyZWN0IG9mZmVzdC5cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcbiAgICBzb3VyY2UgKz0gXCInO1xcblwiO1xuXG4gICAgLy8gSWYgYSB2YXJpYWJsZSBpcyBub3Qgc3BlY2lmaWVkLCBwbGFjZSBkYXRhIHZhbHVlcyBpbiBsb2NhbCBzY29wZS5cbiAgICBpZiAoIXNldHRpbmdzLnZhcmlhYmxlKSBzb3VyY2UgPSAnd2l0aChvYmp8fHt9KXtcXG4nICsgc291cmNlICsgJ31cXG4nO1xuXG4gICAgc291cmNlID0gXCJ2YXIgX190LF9fcD0nJyxfX2o9QXJyYXkucHJvdG90eXBlLmpvaW4sXCIgK1xuICAgICAgXCJwcmludD1mdW5jdGlvbigpe19fcCs9X19qLmNhbGwoYXJndW1lbnRzLCcnKTt9O1xcblwiICtcbiAgICAgIHNvdXJjZSArICdyZXR1cm4gX19wO1xcbic7XG5cbiAgICB0cnkge1xuICAgICAgdmFyIHJlbmRlciA9IG5ldyBGdW5jdGlvbihzZXR0aW5ncy52YXJpYWJsZSB8fCAnb2JqJywgJ18nLCBzb3VyY2UpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGUuc291cmNlID0gc291cmNlO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICB2YXIgdGVtcGxhdGUgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICByZXR1cm4gcmVuZGVyLmNhbGwodGhpcywgZGF0YSwgXyk7XG4gICAgfTtcblxuICAgIC8vIFByb3ZpZGUgdGhlIGNvbXBpbGVkIHNvdXJjZSBhcyBhIGNvbnZlbmllbmNlIGZvciBwcmVjb21waWxhdGlvbi5cbiAgICB2YXIgYXJndW1lbnQgPSBzZXR0aW5ncy52YXJpYWJsZSB8fCAnb2JqJztcbiAgICB0ZW1wbGF0ZS5zb3VyY2UgPSAnZnVuY3Rpb24oJyArIGFyZ3VtZW50ICsgJyl7XFxuJyArIHNvdXJjZSArICd9JztcblxuICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgfTtcblxuICAvLyBBZGQgYSBcImNoYWluXCIgZnVuY3Rpb24uIFN0YXJ0IGNoYWluaW5nIGEgd3JhcHBlZCBVbmRlcnNjb3JlIG9iamVjdC5cbiAgXy5jaGFpbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBpbnN0YW5jZSA9IF8ob2JqKTtcbiAgICBpbnN0YW5jZS5fY2hhaW4gPSB0cnVlO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfTtcblxuICAvLyBPT1BcbiAgLy8gLS0tLS0tLS0tLS0tLS0tXG4gIC8vIElmIFVuZGVyc2NvcmUgaXMgY2FsbGVkIGFzIGEgZnVuY3Rpb24sIGl0IHJldHVybnMgYSB3cmFwcGVkIG9iamVjdCB0aGF0XG4gIC8vIGNhbiBiZSB1c2VkIE9PLXN0eWxlLiBUaGlzIHdyYXBwZXIgaG9sZHMgYWx0ZXJlZCB2ZXJzaW9ucyBvZiBhbGwgdGhlXG4gIC8vIHVuZGVyc2NvcmUgZnVuY3Rpb25zLiBXcmFwcGVkIG9iamVjdHMgbWF5IGJlIGNoYWluZWQuXG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGNvbnRpbnVlIGNoYWluaW5nIGludGVybWVkaWF0ZSByZXN1bHRzLlxuICB2YXIgcmVzdWx0ID0gZnVuY3Rpb24oaW5zdGFuY2UsIG9iaikge1xuICAgIHJldHVybiBpbnN0YW5jZS5fY2hhaW4gPyBfKG9iaikuY2hhaW4oKSA6IG9iajtcbiAgfTtcblxuICAvLyBBZGQgeW91ciBvd24gY3VzdG9tIGZ1bmN0aW9ucyB0byB0aGUgVW5kZXJzY29yZSBvYmplY3QuXG4gIF8ubWl4aW4gPSBmdW5jdGlvbihvYmopIHtcbiAgICBfLmVhY2goXy5mdW5jdGlvbnMob2JqKSwgZnVuY3Rpb24obmFtZSkge1xuICAgICAgdmFyIGZ1bmMgPSBfW25hbWVdID0gb2JqW25hbWVdO1xuICAgICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBbdGhpcy5fd3JhcHBlZF07XG4gICAgICAgIHB1c2guYXBwbHkoYXJncywgYXJndW1lbnRzKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdCh0aGlzLCBmdW5jLmFwcGx5KF8sIGFyZ3MpKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gQWRkIGFsbCBvZiB0aGUgVW5kZXJzY29yZSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIgb2JqZWN0LlxuICBfLm1peGluKF8pO1xuXG4gIC8vIEFkZCBhbGwgbXV0YXRvciBBcnJheSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIuXG4gIF8uZWFjaChbJ3BvcCcsICdwdXNoJywgJ3JldmVyc2UnLCAnc2hpZnQnLCAnc29ydCcsICdzcGxpY2UnLCAndW5zaGlmdCddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG1ldGhvZCA9IEFycmF5UHJvdG9bbmFtZV07XG4gICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvYmogPSB0aGlzLl93cmFwcGVkO1xuICAgICAgbWV0aG9kLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgIGlmICgobmFtZSA9PT0gJ3NoaWZ0JyB8fCBuYW1lID09PSAnc3BsaWNlJykgJiYgb2JqLmxlbmd0aCA9PT0gMCkgZGVsZXRlIG9ialswXTtcbiAgICAgIHJldHVybiByZXN1bHQodGhpcywgb2JqKTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBBZGQgYWxsIGFjY2Vzc29yIEFycmF5IGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlci5cbiAgXy5lYWNoKFsnY29uY2F0JywgJ2pvaW4nLCAnc2xpY2UnXSwgZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBtZXRob2QgPSBBcnJheVByb3RvW25hbWVdO1xuICAgIF8ucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gcmVzdWx0KHRoaXMsIG1ldGhvZC5hcHBseSh0aGlzLl93cmFwcGVkLCBhcmd1bWVudHMpKTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBFeHRyYWN0cyB0aGUgcmVzdWx0IGZyb20gYSB3cmFwcGVkIGFuZCBjaGFpbmVkIG9iamVjdC5cbiAgXy5wcm90b3R5cGUudmFsdWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fd3JhcHBlZDtcbiAgfTtcblxuICAvLyBQcm92aWRlIHVud3JhcHBpbmcgcHJveHkgZm9yIHNvbWUgbWV0aG9kcyB1c2VkIGluIGVuZ2luZSBvcGVyYXRpb25zXG4gIC8vIHN1Y2ggYXMgYXJpdGhtZXRpYyBhbmQgSlNPTiBzdHJpbmdpZmljYXRpb24uXG4gIF8ucHJvdG90eXBlLnZhbHVlT2YgPSBfLnByb3RvdHlwZS50b0pTT04gPSBfLnByb3RvdHlwZS52YWx1ZTtcblxuICBfLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAnJyArIHRoaXMuX3dyYXBwZWQ7XG4gIH07XG5cbiAgLy8gQU1EIHJlZ2lzdHJhdGlvbiBoYXBwZW5zIGF0IHRoZSBlbmQgZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBBTUQgbG9hZGVyc1xuICAvLyB0aGF0IG1heSBub3QgZW5mb3JjZSBuZXh0LXR1cm4gc2VtYW50aWNzIG9uIG1vZHVsZXMuIEV2ZW4gdGhvdWdoIGdlbmVyYWxcbiAgLy8gcHJhY3RpY2UgZm9yIEFNRCByZWdpc3RyYXRpb24gaXMgdG8gYmUgYW5vbnltb3VzLCB1bmRlcnNjb3JlIHJlZ2lzdGVyc1xuICAvLyBhcyBhIG5hbWVkIG1vZHVsZSBiZWNhdXNlLCBsaWtlIGpRdWVyeSwgaXQgaXMgYSBiYXNlIGxpYnJhcnkgdGhhdCBpc1xuICAvLyBwb3B1bGFyIGVub3VnaCB0byBiZSBidW5kbGVkIGluIGEgdGhpcmQgcGFydHkgbGliLCBidXQgbm90IGJlIHBhcnQgb2ZcbiAgLy8gYW4gQU1EIGxvYWQgcmVxdWVzdC4gVGhvc2UgY2FzZXMgY291bGQgZ2VuZXJhdGUgYW4gZXJyb3Igd2hlbiBhblxuICAvLyBhbm9ueW1vdXMgZGVmaW5lKCkgaXMgY2FsbGVkIG91dHNpZGUgb2YgYSBsb2FkZXIgcmVxdWVzdC5cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZSgndW5kZXJzY29yZScsIFtdLCBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBfO1xuICAgIH0pO1xuICB9XG59LmNhbGwodGhpcykpO1xuIiwiLyoqXG4gKiBnaXZlbiBhbiBhcnJheSBvZiBudW1iZXJzLCByZXR1cm4gdGhlIGluZGV4IGF0IHdoaWNoIHRoZSB2YWx1ZSB3b3VsZCBmYWxsXG4gKiBzdW1taW5nIHRoZSBhcnJheSBhcyB5b3UgZ29cbiAqIEBwYXJhbSAge2FycmF5fSBhcnIgYXJyYXkgb2YgbnVtYmVyc1xuICogQHBhcmFtICB7bnVtYmVyfSB2YWwgZ2V0IHRoZSBpbmRleCB3aGVyZSB0aGlzIHdvdWxkIGZhbGxcbiAqIEByZXR1cm4ge251bWJlcn0gICAgIGluZGV4IG9yIC0xIGlmIG5vdCBmb3VuZFxuICovXG5mdW5jdGlvbiBjb250YWlucyhhcnIsIHZhbCkge1xuICAgIHZhciB0b3RhbCA9IDAsXG4gICAgICAgIGxlbiA9IGFyci5sZW5ndGgsXG4gICAgICAgIGk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdG90YWwgKz0gYXJyW2ldO1xuXG4gICAgICAgIGlmICh2YWwgPCB0b3RhbCkge1xuICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gLTE7XG59XG5cblxuLyoqXG4gKiBjb25zdWx0IHRoZSBuZWFyZXN0IGtpbmRlcmdhcnRlbiB0ZWFjaGVyLi4uXG4gKi9cbmZ1bmN0aW9uIGFkZChhLCBiKSB7XG4gICAgcmV0dXJuIGEgKyBiO1xufVxuXG4vKipcbiAqIHN1bSB1bnRpbCB0aGUgZ2l2ZW4gaW5kZXhcbiAqIEBwYXJhbSAge2FycmF5fSBhcnIgYXJyYXkgdG8gcGFydGlhbCBzdW1cbiAqIEBwYXJhbSAge251bWJlcn0gaWR4IGluZGV4XG4gKiBAcmV0dXJuIHtudW1iZXJ9ICAgICBwYXJ0aWFsIHN1bVxuICovXG5mdW5jdGlvbiBwYXJ0aWFsU3VtKGFyciwgaWR4KSB7XG4gICAgdmFyIHN1YnNldCA9IGFyci5zbGljZSgwLCBpZHgpO1xuXG4gICAgcmV0dXJuIHN1YnNldC5yZWR1Y2UoYWRkLCAwKTtcbn1cblxuXG4vKipcbiAqIG1hcCBvdmVyIGFuIGFycmF5IHJldHVybmluZyBhbiBhcnJheSBvZiB0aGUgc2FtZSBsZW5ndGggY29udGFpbmluZyB0aGVcbiAqIHN1bSBhdCBlYWNoIHBsYWNlXG4gKiBAcGFyYW0gIHthcnJheX0gYXJyIGFuIGFycmF5IG9mIG51bWJlcnNcbiAqIEByZXR1cm4ge2FycmF5fSAgICAgdGhlIGFycmF5IG9mIHN1bXNcbiAqL1xuZnVuY3Rpb24gcnVubmluZ1N1bXMoYXJyKSB7XG4gICAgdmFyIHN1bSA9IDA7XG5cbiAgICByZXR1cm4gYXJyLm1hcChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiBzdW0gKz0gaXRlbTtcbiAgICB9KTtcbn1cblxuXG4vKipcbiAqIGdpdmVuIGFuIGFycmF5IG9mIGJvYXJkZXJzLCBnZW5lcmF0ZSBhIHNldCBvZiB4LWNvb3JkcyB0aGF0IHJlcHJlc2VudHMgdGhlXG4gKiB0aGUgYXJlYSBhcm91bmQgdGhlIGJvYXJkZXJzICsvLSB0aGUgdGhyZXNob2xkIGdpdmVuXG4gKiBAcGFyYW0gIHthcnJheX0gYXJyICAgIGFycmF5IG9mIGJvcmRlcnNcbiAqIEBwYXJhbSAge251bWJlcn0gdGhyZXNoIHRoZSB0aHJlc2hvbGQgYXJvdW5kIGVhY2hcbiAqIEByZXR1cm4ge2FycmF5fSAgICAgICAgYW4gYXJyYXkgb2YgYXJyYXlzXG4gKi9cbmZ1bmN0aW9uIGdlbkZ1enp5Qm9yZGVycyhhcnIsIHRocmVzaCkge1xuICAgIHZhciBsZW4gPSBhcnIubGVuZ3RoLFxuICAgICAgICBib3JkZXJzID0gW1xuICAgICAgICAgICAgWzAsIHRocmVzaF1cbiAgICAgICAgXSxcbiAgICAgICAgbWF4UmlnaHQgPSBhcnIucmVkdWNlKGFkZCwgMCksXG4gICAgICAgIHN1bXMgPSBydW5uaW5nU3VtcyhhcnIpLFxuICAgICAgICBpLCBjdXJyO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGN1cnIgPSBzdW1zW2ldO1xuXG4gICAgICAgIGJvcmRlcnMucHVzaChbXG4gICAgICAgICAgICBNYXRoLm1heCgwLCBjdXJyIC0gdGhyZXNoKSxcbiAgICAgICAgICAgIE1hdGgubWluKGN1cnIgKyB0aHJlc2gsIG1heFJpZ2h0KVxuICAgICAgICBdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYm9yZGVyc1xufVxuXG5cbi8qKlxuICogQSB2ZXJzaW9uIG9mIHRoZSBmaW5kSW5kZXggcG9seWZpbGwgZm91bmQgaGVyZTpcbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L2ZpbmRJbmRleFxuICpcbiAqIGFkYXB0ZWQgdG8gcnVuIGFzIHN0YW5kIGFsb25lIGZ1bmN0aW9uXG4gKi9cbmZ1bmN0aW9uIGZpbmRJbmRleChsc3QsIHByZWRpY2F0ZSkge1xuXG4gICAgdmFyIGxpc3QgPSBPYmplY3QobHN0KTtcbiAgICB2YXIgbGVuZ3RoID0gbGlzdC5sZW5ndGggPj4+IDA7XG4gICAgdmFyIHZhbHVlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB2YWx1ZSA9IGxpc3RbaV07XG4gICAgICAgIGlmIChwcmVkaWNhdGUuY2FsbChudWxsLCB2YWx1ZSwgaSwgbGlzdCkpIHtcbiAgICAgICAgICAgIHJldHVybiBpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbn07XG5cblxuZnVuY3Rpb24gaW5SYW5nZShyYW5nZSwgdmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPj0gcmFuZ2VbMF0gJiYgdmFsdWUgPD0gcmFuZ2VbMV07XG59XG5cbi8qKlxuICogcmV0dXJuIHdoYXRldmVyIGdldHMgcGFzc2VkIGluLiBjYW4gYmUgdXNlZnVsIGluIGEgZmlsdGVyIGZ1bmN0aW9uIHdoZXJlXG4gKiB0cnV0aHkgdmFsdWVzIGFyZSB0aGUgb25seSB2YWxpZCBvbmVzXG4gKiBAcGFyYW0gIHthbnl9IGFyZyBhbnkgdmFsdWVcbiAqIEByZXR1cm4ge2FueX0gICAgIHdoYXRldmVyIHdhcyBwYXNzZWQgaW5cbiAqL1xuZnVuY3Rpb24gaWRlbnRpdHkoYXJnKSB7XG4gICAgcmV0dXJuIGFyZztcbn1cblxuLyoqXG4gKiBtb3ZlIGFuIGFycmF5IGluZGV4IHRvIHRoZSAnYm9yZGVyJyBwYXNzZWQgaW4uIHRoZSBib3JkZXJzIGFyZSBub3QgYXJyYXlcbiAqIGluZGV4ZXMsIHRoZXkgYXJlIHRoZSBudW1iZXJzIGluIHRoZSBmb2xsb3dpbmcgZGlhZ3JhbTpcbiAqXG4gKiB8MHxfX19fdmFsX19fX3wxfF9fX19fdmFsX19fX198MnxfX19fX3ZhbF9fX198M3wgZXRjXG4gKlxuICogKiogQWxsIGNvbHVtbiB2YWx1ZXMgYXJlIGFzc3VtZWQgdG8gYmUgdHJ1dGh5IChvYmplY3RzIGluIG1pbmQuLi4pICoqXG4gKlxuICogQHBhcmFtICB7YXJyYXl9IGFyciAgICAgIGFycmF5IHRvIHJlb3JkZXIsIG5vdCBtdXRhdGVkXG4gKiBAcGFyYW0gIHtudW1iZXJ9IGZyb20gICAgIG5vcm1hbCBpbmRleCBvZiBjb2x1bW4gdG8gbW92ZVxuICogQHBhcmFtICB7bnVtYmVyfSB0b0JvcmRlciBib3JkZXIgaW5kZXhcbiAqIEByZXR1cm4ge2FycmF5fSAgICAgICAgICBuZXcgYXJyYXkgaW4gbmV3IG9yZGVyXG4gKi9cbmZ1bmN0aW9uIG1vdmVJZHgoYXJyLCBmcm9tLCB0b0JvcmRlcikge1xuICAgIHZhciByZW9yZGVyZCA9IGFyci5zbGljZSgpLFxuICAgICAgICBtb3ZlciA9IHJlb3JkZXJkLnNwbGljZShmcm9tLCAxLCB1bmRlZmluZWQpWzBdO1xuXG4gICAgcmVvcmRlcmQuc3BsaWNlKHRvQm9yZGVyLCAxLCBtb3ZlciwgcmVvcmRlcmRbdG9Cb3JkZXJdKTtcblxuICAgIHJldHVybiByZW9yZGVyZC5maWx0ZXIoaWRlbnRpdHkpO1xufVxuXG5cblxuXG5cbmZ1bmN0aW9uIGluaXQoc2VsZiwgZGl2SGVhZGVyKSB7XG5cbiAgICB2YXIgZ3JpZEV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJykuZ3JpZEV2ZW50cztcblxuXG4gICAgdmFyIHdpZHRocyA9IHNlbGYuZ2V0Q29sdW1ucygpLm1hcChmdW5jdGlvbihjb2wpIHtcbiAgICAgICAgICAgIHJldHVybiBjb2wuZ2V0V2lkdGgoKTtcbiAgICAgICAgfSksXG4gICAgICAgIHJlc2l6ZVRocmVzaCA9IDUsXG4gICAgICAgIGZ1enp5Qm9yZGVycyA9IGdlbkZ1enp5Qm9yZGVycyh3aWR0aHMsIHJlc2l6ZVRocmVzaCksXG4gICAgICAgIGluc2VydGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXG4gICAgICAgIGhlYWRlckNhbnZhcyA9IHNlbGYuZ2V0SGVhZGVyQ2FudmFzKCksXG4gICAgICAgIGhlYWRlclJlY3QgPSBoZWFkZXJDYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXG4gICAgICAgIGRyYWdIZWFkZXIsIG1vdXNlRG93biwgeCwgeSwgc3RhcnRpbmdUcmFucywgcmVzaXppbmcsXG4gICAgICAgIHJlc2l6aW5nQ29scywgY2xpY2tlZENvbCwgYm9yZGVySGl0LCByZW9yZGVyaW5nLFxuICAgICAgICBsYXN0WCA9IG51bGw7XG5cblxuXG5cbiAgICBpbnNlcnRlci5zdHlsZS5oZWlnaHQgPSAnMjBweCc7XG4gICAgaW5zZXJ0ZXIuc3R5bGUud2lkdGggPSAnNXB4JztcbiAgICBpbnNlcnRlci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnZ29sZGVucm9kJztcbiAgICBpbnNlcnRlci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgaW5zZXJ0ZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBpbnNlcnRlci50b3AgPSAwO1xuICAgIGluc2VydGVyLmxlZnQgPSAwO1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChpbnNlcnRlcik7XG5cblxuICAgIGdyaWRFdmVudHMubW91c2Vtb3ZlLmFkZE9ic2VydmVyKG1vdXNlbW92ZSk7XG4gICAgZ3JpZEV2ZW50cy5tb3VzZXVwLmFkZE9ic2VydmVyKG1vdXNldXApO1xuICAgIGRpdkhlYWRlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBtb3VzZWRvd24pO1xuXG4gICAgZnVuY3Rpb24gbW91c2Vtb3ZlKGUpIHtcbiAgICAgICAgdmFyIHhNb3ZlbWVudCwgeU1vdmVtZW50LCBtb3ZlbWVudFN0cmluZyxcbiAgICAgICAgICAgIGxlZnQgPSBoZWFkZXJSZWN0LmxlZnQsXG4gICAgICAgICAgICByYW5nZUZ1bmMsIG5vcm1hbGl6ZWRCb3JkZXJzLFxuICAgICAgICAgICAgaW5zZXJ0ZXJMZWZ0LCBhY3RpdmVDb2wsIGFjdGl2ZUNvbFdpZHRoLFxuICAgICAgICAgICAgY29sUmVzaXplSW5kZXg7XG5cbiAgICAgICAgd2lkdGhzID0gc2VsZi5nZXRDb2x1bW5zKCkubWFwKGZ1bmN0aW9uKGNvbCkge1xuICAgICAgICAgICAgcmV0dXJuIGNvbC5nZXRXaWR0aCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBmdXp6eUJvcmRlcnMgPSBnZW5GdXp6eUJvcmRlcnMod2lkdGhzLCByZXNpemVUaHJlc2gpLFxuXG4gICAgICAgIHJhbmdlRnVuYyA9IGZ1bmN0aW9uKHJhbmdlKSB7XG4gICAgICAgICAgICByZXR1cm4gaW5SYW5nZShyYW5nZSwgZS5jbGllbnRYKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG5vcm1hbGl6ZWRCb3JkZXJzID0gZnV6enlCb3JkZXJzLm1hcChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICByZXR1cm4gaXRlbS5tYXAoYWRkLmJpbmQobnVsbCwgbGVmdCkpO1xuICAgICAgICB9KVxuXG4gICAgICAgIGlmICghcmVzaXppbmcpIHtcbiAgICAgICAgICAgIGJvcmRlckhpdCA9IGZpbmRJbmRleChub3JtYWxpemVkQm9yZGVycywgcmFuZ2VGdW5jKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggKCByZXNpemluZyB8fCAoYm9yZGVySGl0ICE9PSAtMSkpICYmICFyZW9yZGVyaW5nICkge1xuICAgICAgICAgICAgZGl2SGVhZGVyLnN0eWxlLmN1cnNvciA9ICdjb2wtcmVzaXplJztcbiAgICAgICAgICAgIHJlc2l6aW5nQ29scyA9IHRydWU7XG5cbiAgICAgICAgICAgIGlmIChtb3VzZURvd24pIHtcbiAgICAgICAgICAgICAgICBpZiAoYm9yZGVySGl0ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb2xSZXNpemVJbmRleCA9IGNsaWNrZWRDb2w7XG4gICAgICAgICAgICAgICAgICAgIGFjdGl2ZUNvbCA9IHNlbGYuZ2V0Q29sdW1ucygpW2NvbFJlc2l6ZUluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgYWN0aXZlQ29sV2lkdGggPSBhY3RpdmVDb2wuZ2V0V2lkdGgoKTtcbiAgICAgICAgICAgICAgICAgICAgYWN0aXZlQ29sLnNldFdpZHRoKE1hdGgubWF4KDAsIGFjdGl2ZUNvbFdpZHRoICsgKGUuY2xpZW50WCAtIHgpKSk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYucGFpbnRBbGwoKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzaXppbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB4ID0gZS5jbGllbnRYO1xuICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAobW91c2VEb3duIFxuICAgICAgICAgICAgJiYgZHJhZ0hlYWRlciBcbiAgICAgICAgICAgICYmIChlLmNsaWVudFggPj0gaGVhZGVyUmVjdC5sZWZ0KSBcbiAgICAgICAgICAgICYmIChlLmNsaWVudFggPD0gKGhlYWRlclJlY3QubGVmdCArIGhlYWRlclJlY3Qud2lkdGgpKSBcbiAgICAgICAgICAgICYmICFyZXNpemluZ0NvbHMpIHtcblxuICAgICAgICAgICAgcmVvcmRlcmluZyA9IHRydWU7XG5cbiAgICAgICAgICAgIGlmIChlLnRhcmdldCAhPT0gZHJhZ0hlYWRlcikge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICB4TW92ZW1lbnQgPSBzdGFydGluZ1RyYW5zWzBdIC0gKHggLSBlLmNsaWVudFgpO1xuICAgICAgICAgICAgeU1vdmVtZW50ID0gMDtcbiAgICAgICAgICAgIGxhc3RYID0gZS5jbGllbnRYO1xuXG4gICAgICAgICAgICBtb3ZlbWVudFN0cmluZyA9IFsndHJhbnNsYXRlWCgnLFxuICAgICAgICAgICAgICAgIHhNb3ZlbWVudCxcbiAgICAgICAgICAgICAgICAncHgpIHRyYW5zbGF0ZVkoJyxcbiAgICAgICAgICAgICAgICB5TW92ZW1lbnQsXG4gICAgICAgICAgICAgICAgJ3B4KSdcbiAgICAgICAgICAgIF0uam9pbignJyk7XG5cbiAgICAgICAgICAgIGRyYWdIZWFkZXIuc3R5bGUudHJhbnNmb3JtID0gbW92ZW1lbnRTdHJpbmc7XG4gICAgICAgICAgICBkcmFnSGVhZGVyLnN0eWxlLndlYmtpdFRyYW5zZm9ybSA9IG1vdmVtZW50U3RyaW5nO1xuICAgICAgICAgICAgZHJhZ0hlYWRlci5zdHlsZS56SW5kZXggPSAxMDtcblxuICAgICAgICAgICAgaWYgKGJvcmRlckhpdCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBpbnNlcnRlckxlZnQgPSBub3JtYWxpemVkQm9yZGVyc1tib3JkZXJIaXRdWzBdO1xuICAgICAgICAgICAgICAgIGluc2VydGVyLnN0eWxlLmxlZnQgPSBpbnNlcnRlckxlZnQ7XG4gICAgICAgICAgICAgICAgaW5zZXJ0ZXIuc3R5bGUudG9wID0gaGVhZGVyUmVjdC50b3A7XG4gICAgICAgICAgICAgICAgaW5zZXJ0ZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGluc2VydGVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkaXZIZWFkZXIuc3R5bGUuY3Vyc29yID0gJ2F1dG8nO1xuICAgICAgICAgICAgcmVzaXppbmdDb2xzID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIG1vdXNldXAoZSkge1xuICAgICAgICB2YXIgcmVvcmRlcmVkO1xuXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICB4ID0geSAgPSAwO1xuXG4gICAgICAgIGxhc3RYID0gbnVsbDtcblxuICAgICAgICBpZiAoZHJhZ0hlYWRlcikge1xuICAgICAgICAgICAgZHJhZ0hlYWRlci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGRyYWdIZWFkZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgZHJhZ0hlYWRlciA9IG51bGw7XG4gICAgICAgIHN0YXJ0aW5nVHJhbnMgPSBbMCwgMF07XG4gICAgICAgIG1vdXNlRG93biA9IGZhbHNlO1xuICAgICAgICByZXNpemluZyA9IGZhbHNlO1xuICAgICAgICByZW9yZGVyaW5nID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGJvcmRlckhpdCAhPT0gLTFcbiAgICAgICAgICAgICYmIChlLmNsaWVudFkgPj0gaGVhZGVyUmVjdC50b3ApIFxuICAgICAgICAgICAgJiYgKGUuY2xpZW50WSA8PSAoaGVhZGVyUmVjdC50b3AgKyBoZWFkZXJSZWN0LmhlaWdodCkpICkge1xuICAgICAgICAgICAgcmVvcmRlcmVkID0gbW92ZUlkeChzZWxmLmdldENvbHVtbnMoKSwgY2xpY2tlZENvbCwgYm9yZGVySGl0KTtcbiAgICAgICAgICAgIHNlbGYuc2V0Q29sdW1ucyhyZW9yZGVyZWQpO1xuICAgICAgICAgICAgc2VsZi5wYWludEFsbCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5zZXJ0ZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgaGVhZGVyUmVjdCA9IGhlYWRlckNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgZnV6enlCb3JkZXJzID0gZ2VuRnV6enlCb3JkZXJzKHdpZHRocywgcmVzaXplVGhyZXNoKTtcbiAgICAgICAgd2lkdGhzID0gc2VsZi5nZXRDb2x1bW5zKCkubWFwKGZ1bmN0aW9uKGNvbCkge1xuICAgICAgICAgICAgcmV0dXJuIGNvbC5nZXRXaWR0aCgpO1xuICAgICAgICB9KTtcblxuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gbW91c2Vkb3duKGUpIHtcblxuICAgICAgICBtb3VzZURvd24gPSB0cnVlO1xuXG4gICAgICAgIHdpZHRocyA9IHNlbGYuZ2V0Q29sdW1ucygpLm1hcChmdW5jdGlvbihjb2wpIHtcbiAgICAgICAgICAgIHJldHVybiBjb2wuZ2V0V2lkdGgoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY2xpY2tlZENvbCA9IGNvbnRhaW5zKHdpZHRocywgZS5vZmZzZXRYKTtcblxuICAgICAgICB4ID0gZS5jbGllbnRYO1xuICAgICAgICB5ID0gZS55O1xuXG5cbiAgICAgICAgaWYgKHJlc2l6aW5nQ29scykge1xuICAgICAgICAgICAgLy8gYWx3YXlzIHJlc2l6ZSBsIHRvIHIgXG4gICAgICAgICAgICBjbGlja2VkQ29sID0gY29udGFpbnMod2lkdGhzLCBlLm9mZnNldFggLSByZXNpemVUaHJlc2gpO1xuICAgICAgICAgICAgcmV0dXJuOyAvLyBncm9zcy4uLi5cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjb2xPZmZzZXQgPSBwYXJ0aWFsU3VtKHdpZHRocywgY2xpY2tlZENvbCksXG4gICAgICAgICAgICBpbWFnZSA9IG5ldyBJbWFnZSgpLFxuICAgICAgICAgICAgc3ViQ2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyksXG4gICAgICAgICAgICBzdWJDdHggPSBzdWJDYW52YXMuZ2V0Q29udGV4dCgnMmQnKSxcbiAgICAgICAgICAgIGNsaWNrZWRDb2xXaWR0aCA9IHdpZHRoc1tjbGlja2VkQ29sXSxcbiAgICAgICAgICAgIHRyYW5zZm9ybSwgY3R4O1xuXG4gICAgICAgIC8vIGJvZHkgaXMgcHJvYiBub3QgdGhlIGJlc3Qgc3BvdCBmb3IgdGhpcy4uLiBcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChzdWJDYW52YXMpO1xuXG4gICAgICAgIGhlYWRlclJlY3QgPSBoZWFkZXJDYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgIGZ1enp5Qm9yZGVycyA9IGdlbkZ1enp5Qm9yZGVycyh3aWR0aHMsIHJlc2l6ZVRocmVzaCk7XG5cbiAgICAgICAgY3R4ID0gaGVhZGVyQ2FudmFzLmdldENvbnRleHQoJzJkJyk7XG5cbiAgICAgICAgc3ViQ2FudmFzLndpZHRoID0gY2xpY2tlZENvbFdpZHRoO1xuICAgICAgICBzdWJDYW52YXMuaGVpZ2h0ID0gMjA7XG4gICAgICAgIHN1YkNhbnZhcy5zdHlsZS5vcGFjaXR5ID0gJy40NSc7XG4gICAgICAgIHN1YkNhbnZhcy5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgIHN1YkNhbnZhcy5zdHlsZS5sZWZ0ID0gZS5jbGllbnRYIC0gKGUub2Zmc2V0WCAtIGNvbE9mZnNldCk7XG4gICAgICAgIHN1YkNhbnZhcy5zdHlsZS50b3AgPSBoZWFkZXJSZWN0LnRvcDtcbiAgICAgICAgc3ViQ2FudmFzLnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcblxuICAgICAgICBzdWJDdHguZHJhd0ltYWdlKFxuICAgICAgICAgICAgaGVhZGVyQ2FudmFzLFxuICAgICAgICAgICAgY29sT2Zmc2V0LCAvLyBzeCwgXG4gICAgICAgICAgICAwLCAvLyBzeSwgXG4gICAgICAgICAgICBjbGlja2VkQ29sV2lkdGgsIC8vIHNXaWR0aCwgXG4gICAgICAgICAgICAyMCwgLy8gc0hlaWdodCwgXG4gICAgICAgICAgICAwLCAvLyBkeCwgXG4gICAgICAgICAgICAwLCAvLyBkeSwgXG4gICAgICAgICAgICBjbGlja2VkQ29sV2lkdGgsXG4gICAgICAgICAgICAyMCk7XG5cblxuICAgICAgICBkcmFnSGVhZGVyID0gc3ViQ2FudmFzO1xuXG4gICAgICAgIHRyYW5zZm9ybSA9IGRyYWdIZWFkZXIuc3R5bGUudHJhbnNmb3JtO1xuXG4gICAgICAgIHN0YXJ0aW5nVHJhbnMgPSB0cmFuc2Zvcm0ubWF0Y2goLyhbXihdP1xcZCspL2cpIHx8IFswLCAwXTtcbiAgICB9XG5cbn1cblxuZXhwb3J0cy5pbml0ID0gaW5pdDsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBkZWZhdWx0UmVuZGVyZXIgPSByZXF1aXJlKCcuL2RlZmF1bHRjZWxscmVuZGVyZXIuanMnKTtcblxudmFyIENvbHVtbiA9IGZ1bmN0aW9uKGdyaWQsIGZpZWxkLCBsYWJlbCwgdHlwZSwgd2lkdGgsIHJlbmRlcmVyKSB7XG5cbiAgICByZW5kZXJlciA9IHJlbmRlcmVyIHx8IGRlZmF1bHRSZW5kZXJlcjtcblxuICAgIHRoaXMuZ2V0R3JpZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gZ3JpZDtcbiAgICB9O1xuXG4gICAgdGhpcy5zZXRHcmlkID0gZnVuY3Rpb24obmV3R3JpZCkge1xuICAgICAgICBncmlkID0gbmV3R3JpZDtcbiAgICB9O1xuXG4gICAgdGhpcy5nZXRGaWVsZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gZmllbGQ7XG4gICAgfTtcblxuICAgIHRoaXMuc2V0RmllbGQgPSBmdW5jdGlvbihuZXdGaWVsZCkge1xuICAgICAgICBmaWVsZCA9IG5ld0ZpZWxkO1xuICAgIH07XG5cbiAgICB0aGlzLmdldExhYmVsID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBsYWJlbDtcbiAgICB9O1xuXG4gICAgdGhpcy5zZXRMYWJlbCA9IGZ1bmN0aW9uKG5ld0xhYmVsKSB7XG4gICAgICAgIGxhYmVsID0gbmV3TGFiZWw7XG4gICAgfTtcblxuICAgIHRoaXMuZ2V0VHlwZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdHlwZTtcbiAgICB9O1xuXG4gICAgdGhpcy5zZXRUeXBlID0gZnVuY3Rpb24obmV3VHlwZSkge1xuICAgICAgICB0eXBlID0gbmV3VHlwZTtcbiAgICB9O1xuXG4gICAgdGhpcy5nZXRSZW5kZXJlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcmVuZGVyZXI7XG4gICAgfTtcblxuICAgIHRoaXMuc2V0UmVuZGVyZXIgPSBmdW5jdGlvbihuZXdSZW5kZXJlcikge1xuICAgICAgICByZW5kZXJlciA9IG5ld1JlbmRlcmVyO1xuICAgIH07XG5cbiAgICB0aGlzLmdldFdpZHRoID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB3aWR0aDtcbiAgICB9O1xuXG4gICAgdGhpcy5zZXRXaWR0aCA9IGZ1bmN0aW9uKG5ld1dpZHRoKSB7XG4gICAgICAgIHdpZHRoID0gbmV3V2lkdGg7XG4gICAgfTtcbn07XG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbHVtbjsiLCIndXNlIHN0cmljdCc7XG5cblxudmFyIHBhaW50ID0gZnVuY3Rpb24oZ2MsIGNvbmZpZykge1xuXG4gICAgdmFyIHZhbHVlID0gY29uZmlnLnZhbHVlO1xuICAgIHZhciBib3VuZHMgPSBjb25maWcuYm91bmRzO1xuXG4gICAgdmFyIHggPSBib3VuZHMueDtcbiAgICB2YXIgeSA9IGJvdW5kcy55O1xuICAgIHZhciB3aWR0aCA9IGJvdW5kcy53aWR0aDtcbiAgICB2YXIgaGVpZ2h0ID0gYm91bmRzLmhlaWdodDtcbiAgICB2YXIgZm9udCA9IGNvbmZpZy5mb250O1xuXG4gICAgdmFyIGhhbGlnbiA9IGNvbmZpZy5oYWxpZ24gfHwgJ3JpZ2h0JztcbiAgICB2YXIgdmFsaWduT2Zmc2V0ID0gY29uZmlnLnZvZmZzZXQgfHwgMDtcblxuICAgIHZhciBjZWxsUGFkZGluZyA9IGNvbmZpZy5jZWxsUGFkZGluZyB8fCAwO1xuICAgIHZhciBoYWxpZ25PZmZzZXQgPSAwO1xuICAgIHZhciB0ZXh0V2lkdGggPSBjb25maWcuZ2V0VGV4dFdpZHRoKGdjLCB2YWx1ZSk7XG4gICAgdmFyIGZvbnRNZXRyaWNzID0gY29uZmlnLmdldFRleHRIZWlnaHQoZm9udCk7XG5cbiAgICBpZiAoZ2MuZm9udCAhPT0gY29uZmlnLmZvbnQpIHtcbiAgICAgICAgZ2MuZm9udCA9IGNvbmZpZy5mb250O1xuICAgIH1cbiAgICBpZiAoZ2MudGV4dEFsaWduICE9PSAnbGVmdCcpIHtcbiAgICAgICAgZ2MudGV4dEFsaWduID0gJ2xlZnQnO1xuICAgIH1cbiAgICBpZiAoZ2MudGV4dEJhc2VsaW5lICE9PSAnbWlkZGxlJykge1xuICAgICAgICBnYy50ZXh0QmFzZWxpbmUgPSAnbWlkZGxlJztcbiAgICB9XG5cbiAgICBpZiAoaGFsaWduID09PSAncmlnaHQnKSB7XG4gICAgICAgIC8vdGV4dFdpZHRoID0gY29uZmlnLmdldFRleHRXaWR0aChnYywgY29uZmlnLnZhbHVlKTtcbiAgICAgICAgaGFsaWduT2Zmc2V0ID0gd2lkdGggLSBjZWxsUGFkZGluZyAtIHRleHRXaWR0aDtcbiAgICB9IGVsc2UgaWYgKGhhbGlnbiA9PT0gJ2NlbnRlcicpIHtcbiAgICAgICAgLy90ZXh0V2lkdGggPSBjb25maWcuZ2V0VGV4dFdpZHRoKGdjLCBjb25maWcudmFsdWUpO1xuICAgICAgICBoYWxpZ25PZmZzZXQgPSAod2lkdGggLSB0ZXh0V2lkdGgpIC8gMjtcbiAgICB9IGVsc2UgaWYgKGhhbGlnbiA9PT0gJ2xlZnQnKSB7XG4gICAgICAgIGhhbGlnbk9mZnNldCA9IGNlbGxQYWRkaW5nO1xuICAgIH1cblxuICAgIGhhbGlnbk9mZnNldCA9IE1hdGgubWF4KDAsIGhhbGlnbk9mZnNldCk7XG4gICAgdmFsaWduT2Zmc2V0ID0gdmFsaWduT2Zmc2V0ICsgTWF0aC5jZWlsKGhlaWdodCAvIDIpO1xuXG4gICAgLy9maWxsIGJhY2tncm91bmQgb25seSBpZiBvdXIgYmFja2dyb3VuZENvbG9yIGlzIHBvcHVsYXRlZCBvciB3ZSBhcmUgYSBzZWxlY3RlZCBjZWxsXG4gICAgaWYgKGNvbmZpZy5iYWNrZ3JvdW5kQ29sb3IgfHwgY29uZmlnLmlzU2VsZWN0ZWQpIHtcbiAgICAgICAgZ2MuZmlsbFN0eWxlID0gY29uZmlnLmlzU2VsZWN0ZWQgPyBjb25maWcuYmdTZWxDb2xvciA6IGNvbmZpZy5iYWNrZ3JvdW5kQ29sb3I7XG4gICAgICAgIGdjLmZpbGxSZWN0KHgsIHksIHdpZHRoLCBoZWlnaHQpO1xuICAgIH1cblxuICAgIC8vZHJhdyB0ZXh0XG4gICAgdmFyIHRoZUNvbG9yID0gY29uZmlnLmlzU2VsZWN0ZWQgPyBjb25maWcuZmdTZWxDb2xvciA6IGNvbmZpZy5jb2xvcjtcbiAgICBpZiAoZ2MuZmlsbFN0eWxlICE9PSB0aGVDb2xvcikge1xuICAgICAgICBnYy5maWxsU3R5bGUgPSB0aGVDb2xvcjtcbiAgICAgICAgZ2Muc3Ryb2tlU3R5bGUgPSB0aGVDb2xvcjtcbiAgICB9XG4gICAgaWYgKHZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgIGdjLmZpbGxUZXh0KHZhbHVlLCB4ICsgaGFsaWduT2Zmc2V0LCB5ICsgdmFsaWduT2Zmc2V0KTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcGFpbnQ7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmFuZG9tUm93ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJvdyA9IHtcbiAgICAgICAgd29yazogJycsXG4gICAgICAgIGJpZHM6IChNYXRoLnJhbmRvbSgpICogMTAwKS50b0ZpeGVkKDApLFxuICAgICAgICBwcmljZTogKE1hdGgucmFuZG9tKCkgKiAxMDAwKS50b0ZpeGVkKDIpLFxuICAgICAgICBhc2tzOiAoTWF0aC5yYW5kb20oKSAqIDEwMCkudG9GaXhlZCgwKSxcbiAgICAgICAgbHRxOiAoTWF0aC5yYW5kb20oKSAqIDEwMDApLnRvRml4ZWQoMClcbiAgICB9O1xuICAgIHJldHVybiByb3c7XG59O1xuXG52YXIgZ2VuZXJhdGVSYW5kb21EYXRhID0gZnVuY3Rpb24ocm93Q291bnQpIHtcbiAgICB2YXIgZGF0YSA9IG5ldyBBcnJheShyb3dDb3VudCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGRhdGFbaV0gPSByYW5kb21Sb3coKTtcbiAgICB9XG4gICAgcmV0dXJuIGRhdGE7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGdlbmVyYXRlUmFuZG9tRGF0YTsiLCJ2YXIgZ3JpZEV2ZW50cyA9IG5ldyBHcmlkRXZlbnRzKCk7XG5cbm1vZHVsZS5leHBvcnRzLmdyaWRFdmVudHMgPSBncmlkRXZlbnRzO1xuXG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgZ2VtbSA9IGdyaWRFdmVudHMubW91c2Vtb3ZlO1xuXG4gICAgZS54ID0gZS54IHx8IGUuY2xpZW50WDtcbiAgICBlLnkgPSBlLnkgfHwgZS5jbGllbnRZO1xuXG4gICAgZ2VtbS5ub3RpZnkuYmluZChnZW1tKShlLCBncmlkRXZlbnRzKTtcbn0pO1xuXG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgZ2VtZCA9IGdyaWRFdmVudHMubW91c2Vkb3duO1xuXG4gICAgZS54ID0gZS54IHx8IGUuY2xpZW50WDtcbiAgICBlLnkgPSBlLnkgfHwgZS5jbGllbnRZO1xuXG4gICAgZ2VtZC5ub3RpZnkuYmluZChnZW1kKShlLCBncmlkRXZlbnRzKTtcbn0pO1xuXG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBmdW5jdGlvbihlKSB7XG4gICAgdmFyIGdlbXUgPSBncmlkRXZlbnRzLm1vdXNldXA7XG5cbiAgICBlLnggPSBlLnggfHwgZS5jbGllbnRYO1xuICAgIGUueSA9IGUueSB8fCBlLmNsaWVudFk7XG5cbiAgICBnZW11Lm5vdGlmeS5iaW5kKGdlbXUpKGUsIGdyaWRFdmVudHMpO1xufSk7XG5cblxuZnVuY3Rpb24gU2ltcGxlT2JzZXJ2YWJsZSgpIHtcbiAgICB0aGlzLm9ic2VydmVycyAgPSBbXTtcbn07XG5cblxuU2ltcGxlT2JzZXJ2YWJsZS5wcm90b3R5cGUuYWRkT2JzZXJ2ZXIgPSBmdW5jdGlvbihjYWxsYmFjayl7XG4gICAgdGhpcy5vYnNlcnZlcnMucHVzaChjYWxsYmFjayk7XG59O1xuXG5TaW1wbGVPYnNlcnZhYmxlLnByb3RvdHlwZS5yZW1vdmVPYnNlcnZlciA9IGZ1bmN0aW9uKGNhbGxiYWNrKXtcbiAgICB2YXIgY2FsbGJhY2tJbmRleCA9IHRoaXMub2JzZXJ2ZXJzLmluZGV4T2YoY2FsbGJhY2spO1xuXG4gICAgaWYgKGNhbGxiYWNrSW5kZXggIT09IC0xKSB7XG4gICAgICAgIHRoaXMub2JzZXJ2ZXJzLnNwbGljZShjYWxsYmFja0luZGV4LCAxKTtcbiAgICB9XG59O1xuXG5TaW1wbGVPYnNlcnZhYmxlLnByb3RvdHlwZS5ub3RpZnkgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgaSA9IDAsXG4gICAgICAgIGxlbiA9IHRoaXMub2JzZXJ2ZXJzLmxlbmd0aDtcblxuICAgIGZvciAoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdGhpcy5vYnNlcnZlcnNbaV0uYXBwbHkodGhpcywgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSk7XG4gICAgfVxuXG59O1xuXG5cbmZ1bmN0aW9uIEdyaWRFdmVudHMoKSB7XG4gICAgLy8gZ2VuZXJpYyBET00gZXZlbnRzXG4gICAgdGhpcy5tb3VzZXVwID0gT2JqZWN0LmNyZWF0ZShuZXcgU2ltcGxlT2JzZXJ2YWJsZSgpKTtcbiAgICB0aGlzLm1vdXNlZG93biA9IE9iamVjdC5jcmVhdGUobmV3IFNpbXBsZU9ic2VydmFibGUoKSk7XG4gICAgdGhpcy5tb3VzZW1vdmUgPSBPYmplY3QuY3JlYXRlKG5ldyBTaW1wbGVPYnNlcnZhYmxlKCkpO1xufTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBDb2x1bW4gPSByZXF1aXJlKCcuL2NvbHVtbi5qcycpO1xudmFyIFNpbXBsZUxSVSA9IHJlcXVpcmUoJ3NpbXBsZS1scnUnKTtcbnZhciBkZWZhdWx0Y2VsbHJlbmRlcmVyID0gcmVxdWlyZSgnLi9kZWZhdWx0Y2VsbHJlbmRlcmVyLmpzJyk7XG52YXIgcmVzaXphYmxlcyA9IFtdO1xudmFyIHJlc2l6ZUxvb3BSdW5uaW5nID0gdHJ1ZTtcbnZhciBmb250RGF0YSA9IHt9O1xudmFyIHRleHRXaWR0aENhY2hlID0gbmV3IFNpbXBsZUxSVSgxMDAwMCk7XG5cblxudmFyIHJlc2l6YWJsZXNMb29wRnVuY3Rpb24gPSBmdW5jdGlvbihub3cpIHtcbiAgICBpZiAoIXJlc2l6ZUxvb3BSdW5uaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXNpemFibGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXNpemFibGVzW2ldKG5vdyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgfVxufTtcbnNldEludGVydmFsKHJlc2l6YWJsZXNMb29wRnVuY3Rpb24sIDIwMCk7XG5cblxuZnVuY3Rpb24gR3JpZChkb21FbGVtZW50LCBtb2RlbCwgcHJvcGVydGllcykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIG9wdGlvbnMgPSB0aGlzLmdldERlZmF1bHRQcm9wZXJ0aWVzKCk7XG4gICAgdGhpcy5hZGRQcm9wZXJ0aWVzKHByb3BlcnRpZXMpO1xuXG4gICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIHZhciBoZWFkZXJDYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICB2YXIgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XG4gICAgdmFyIGhlYWRlckNvbnRleHQgPSBoZWFkZXJDYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xuICAgIHZhciBjb2x1bW5zID0gW107XG5cbiAgICBtb2RlbC5jaGFuZ2VkID0gZnVuY3Rpb24oeCwgeSkge1xuICAgICAgICBzZWxmLnBhaW50KHgsIHkpO1xuICAgIH07XG5cbiAgICB0aGlzLmdldENhbnZhcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gY2FudmFzO1xuICAgIH07XG5cbiAgICB0aGlzLmdldEhlYWRlckNhbnZhcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gaGVhZGVyQ2FudmFzO1xuICAgIH07XG5cbiAgICB0aGlzLmdldENvbnRhaW5lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gZG9tRWxlbWVudDtcbiAgICB9O1xuXG4gICAgdGhpcy5nZXRDb250ZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBjb250ZXh0O1xuICAgIH07XG5cbiAgICB0aGlzLmdldEhlYWRlckNvbnRleHQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGhlYWRlckNvbnRleHQ7XG4gICAgfTtcblxuICAgIHRoaXMuZ2V0TW9kZWwgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIG1vZGVsO1xuICAgIH07XG5cbiAgICB0aGlzLnNldE1vZGVsID0gZnVuY3Rpb24oZ3JpZE1vZGVsKSB7XG4gICAgICAgIG1vZGVsID0gZ3JpZE1vZGVsO1xuICAgIH07XG5cbiAgICB0aGlzLmdldENvbHVtbnMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGNvbHVtbnM7XG4gICAgfVxuXG4gICAgdGhpcy5zZXRDb2x1bW5zID0gZnVuY3Rpb24gKGNvbHMpIHtcbiAgICAgICAgY29sdW1ucyA9IGNvbHM7XG4gICAgfVxuXG4gICAgdGhpcy5nZXRPcHRpb25zID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgIH07XG5cbiAgICB0aGlzLnNldE9wdGlvbnMgPSBmdW5jdGlvbihuZXdPcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBuZXdPcHRpb25zO1xuICAgIH07XG5cbiAgICB0aGlzLmluaXRpYWxpemUoKVxufTtcblxuR3JpZC5wcm90b3R5cGUuZ2V0RGVmYXVsdFByb3BlcnRpZXMgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBmb250OiAnMTNweCBUYWhvbWEsIEdlbmV2YSwgc2Fucy1zZXJpZicsXG4gICAgICAgIGNvbG9yOiAnI2ZmZmZmZicsXG4gICAgICAgIGJhY2tncm91bmRDb2xvcjogJyM1MDUwNTAnLFxuICAgICAgICBmb3JlZ3JvdW5kU2VsQ29sb3I6ICdyZ2IoMjUsIDI1LCAyNSknLFxuICAgICAgICBiYWNrZ3JvdW5kU2VsQ29sb3I6ICdyZ2IoMTgzLCAyMTksIDI1NSknLFxuXG4gICAgICAgIHRvcExlZnRGb250OiAnMTRweCBUYWhvbWEsIEdlbmV2YSwgc2Fucy1zZXJpZicsXG4gICAgICAgIHRvcExlZnRDb2xvcjogJ3JnYigyNSwgMjUsIDI1KScsXG4gICAgICAgIHRvcExlZnRCYWNrZ3JvdW5kQ29sb3I6ICdyZ2IoMjIzLCAyMjcsIDIzMiknLFxuICAgICAgICB0b3BMZWZ0RkdTZWxDb2xvcjogJ3JnYigyNSwgMjUsIDI1KScsXG4gICAgICAgIHRvcExlZnRCR1NlbENvbG9yOiAncmdiKDI1NSwgMjIwLCA5NyknLFxuXG4gICAgICAgIGZpeGVkQ29sdW1uRm9udDogJzE0cHggVGFob21hLCBHZW5ldmEsIHNhbnMtc2VyaWYnLFxuICAgICAgICBmaXhlZENvbHVtbkNvbG9yOiAncmdiKDI1LCAyNSwgMjUpJyxcbiAgICAgICAgZml4ZWRDb2x1bW5CYWNrZ3JvdW5kQ29sb3I6ICdyZ2IoMjIzLCAyMjcsIDIzMiknLFxuICAgICAgICBmaXhlZENvbHVtbkZHU2VsQ29sb3I6ICdyZ2IoMjUsIDI1LCAyNSknLFxuICAgICAgICBmaXhlZENvbHVtbkJHU2VsQ29sb3I6ICdyZ2IoMjU1LCAyMjAsIDk3KScsXG5cbiAgICAgICAgZml4ZWRSb3dGb250OiAnMTFweCBUYWhvbWEsIEdlbmV2YSwgc2Fucy1zZXJpZicsXG4gICAgICAgIGZpeGVkUm93Q29sb3I6ICcjZmZmZmZmJyxcbiAgICAgICAgZml4ZWRSb3dCYWNrZ3JvdW5kQ29sb3I6ICcjMzAzMDMwJyxcbiAgICAgICAgZml4ZWRSb3dGR1NlbENvbG9yOiAncmdiKDI1LCAyNSwgMjUpJyxcbiAgICAgICAgZml4ZWRSb3dCR1NlbENvbG9yOiAncmdiKDI1NSwgMjIwLCA5NyknLFxuXG4gICAgICAgIGJhY2tncm91bmRDb2xvcjI6ICcjMzAzMDMwJyxcbiAgICAgICAgbGluZUNvbG9yOiAnIzcwNzA3MCcsXG4gICAgICAgIHZvZmZzZXQ6IDAsXG4gICAgICAgIHNjcm9sbGluZ0VuYWJsZWQ6IGZhbHNlLFxuXG4gICAgICAgIGRlZmF1bHRSb3dIZWlnaHQ6IDI1LFxuICAgICAgICBkZWZhdWx0Rml4ZWRSb3dIZWlnaHQ6IDIwLFxuICAgICAgICBkZWZhdWx0Q29sdW1uV2lkdGg6IDEwMCxcbiAgICAgICAgZGVmYXVsdEZpeGVkQ29sdW1uV2lkdGg6IDEwMCxcbiAgICAgICAgY2VsbFBhZGRpbmc6IDVcbiAgICB9O1xufTtcblxuR3JpZC5wcm90b3R5cGUuZ2V0VGV4dFdpZHRoID0gZnVuY3Rpb24oZ2MsIHN0cmluZykge1xuICAgIGlmIChzdHJpbmcgPT09IG51bGwgfHwgc3RyaW5nID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIHN0cmluZyA9IHN0cmluZyArICcnO1xuICAgIGlmIChzdHJpbmcubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICB2YXIga2V5ID0gZ2MuZm9udCArIHN0cmluZztcbiAgICB2YXIgd2lkdGggPSB0ZXh0V2lkdGhDYWNoZS5nZXQoa2V5KTtcbiAgICBpZiAoIXdpZHRoKSB7XG4gICAgICAgIHdpZHRoID0gZ2MubWVhc3VyZVRleHQoc3RyaW5nKS53aWR0aDtcbiAgICAgICAgdGV4dFdpZHRoQ2FjaGUuc2V0KGtleSwgd2lkdGgpO1xuICAgIH1cbiAgICByZXR1cm4gd2lkdGg7XG59O1xuXG5cbkdyaWQucHJvdG90eXBlLmdldFRleHRIZWlnaHQgPSBmdW5jdGlvbihmb250KSB7XG5cbiAgICB2YXIgcmVzdWx0ID0gZm9udERhdGFbZm9udF07XG4gICAgaWYgKHJlc3VsdCkge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICByZXN1bHQgPSB7fTtcbiAgICB2YXIgdGV4dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICB0ZXh0LnRleHRDb250ZW50ID0gJ0hnJztcbiAgICB0ZXh0LnN0eWxlLmZvbnQgPSBmb250O1xuXG4gICAgdmFyIGJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgYmxvY2suc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuICAgIGJsb2NrLnN0eWxlLndpZHRoID0gJzFweCc7XG4gICAgYmxvY2suc3R5bGUuaGVpZ2h0ID0gJzBweCc7XG5cbiAgICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgZGl2LmFwcGVuZENoaWxkKHRleHQpO1xuICAgIGRpdi5hcHBlbmRDaGlsZChibG9jayk7XG5cbiAgICBkaXYuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGl2KTtcblxuICAgIHRyeSB7XG5cbiAgICAgICAgYmxvY2suc3R5bGUudmVydGljYWxBbGlnbiA9ICdiYXNlbGluZSc7XG5cbiAgICAgICAgdmFyIGJsb2NrUmVjdCA9IGJsb2NrLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICB2YXIgdGV4dFJlY3QgPSB0ZXh0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgIHJlc3VsdC5hc2NlbnQgPSBibG9ja1JlY3QudG9wIC0gdGV4dFJlY3QudG9wO1xuXG4gICAgICAgIGJsb2NrLnN0eWxlLnZlcnRpY2FsQWxpZ24gPSAnYm90dG9tJztcbiAgICAgICAgcmVzdWx0LmhlaWdodCA9IGJsb2NrUmVjdC50b3AgLSB0ZXh0UmVjdC50b3A7XG5cbiAgICAgICAgcmVzdWx0LmRlc2NlbnQgPSByZXN1bHQuaGVpZ2h0IC0gcmVzdWx0LmFzY2VudDtcblxuICAgIH0gZmluYWxseSB7XG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGl2KTtcbiAgICB9XG4gICAgaWYgKHJlc3VsdC5oZWlnaHQgIT09IDApIHtcbiAgICAgICAgZm9udERhdGFbZm9udF0gPSByZXN1bHQ7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5HcmlkLnByb3RvdHlwZS5tZXJnZSA9IGZ1bmN0aW9uKHByb3BlcnRpZXMxLCBwcm9wZXJ0aWVzMikge1xuICAgIGZvciAodmFyIGtleSBpbiBwcm9wZXJ0aWVzMikge1xuICAgICAgICBpZiAocHJvcGVydGllczIuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgcHJvcGVydGllczFba2V5XSA9IHByb3BlcnRpZXMyW2tleV07XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5HcmlkLnByb3RvdHlwZS5hZGRQcm9wZXJ0aWVzID0gZnVuY3Rpb24ocHJvcGVydGllcykge1xuICAgIHRoaXMubWVyZ2UodGhpcy5vcHRpb25zLCBwcm9wZXJ0aWVzKTtcbn07XG5cbkdyaWQucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGZpeGVkUm93SGVpZ2h0ID0gdGhpcy5nZXRGaXhlZFJvd0hlaWdodCgpO1xuICAgIHZhciBjb250YWluZXIgPSB0aGlzLmdldENvbnRhaW5lcigpO1xuICAgIHZhciBkaXZIZWFkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBkaXZIZWFkZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgIGRpdkhlYWRlci5zdHlsZS50b3AgPSAwO1xuICAgIGRpdkhlYWRlci5zdHlsZS5yaWdodCA9IDA7XG4gICAgZGl2SGVhZGVyLnN0eWxlLmxlZnQgPSAwO1xuICAgIGRpdkhlYWRlci5zdHlsZS5vdmVyZmxvdyA9ICdoaWRkZW4nO1xuXG4gICAgZGl2SGVhZGVyLmFwcGVuZENoaWxkKHRoaXMuZ2V0SGVhZGVyQ2FudmFzKCkpO1xuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChkaXZIZWFkZXIpO1xuXG4gICAgcmVxdWlyZSgnLi9jb2wtcmVvcmRlci5qcycpLmluaXQoc2VsZiwgZGl2SGVhZGVyKTtcblxuICAgIHZhciBkaXZNYWluID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgZGl2TWFpbi5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgZGl2TWFpbi5zdHlsZS50b3AgPSBmaXhlZFJvd0hlaWdodCArICdweCc7XG4gICAgZGl2TWFpbi5zdHlsZS5yaWdodCA9IDA7XG4gICAgZGl2TWFpbi5zdHlsZS5ib3R0b20gPSAwO1xuICAgIGRpdk1haW4uc3R5bGUubGVmdCA9IDA7XG4gICAgZGl2TWFpbi5zdHlsZS5vdmVyZmxvdyA9ICdhdXRvJztcbiAgICBkaXZNYWluLnN0eWxlLm1zT3ZlcmZsb3dTdHlsZSA9ICctbXMtYXV0b2hpZGluZy1zY3JvbGxiYXInO1xuICAgIGRpdk1haW4uYWRkRXZlbnRMaXN0ZW5lcihcInNjcm9sbFwiLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGRpdkhlYWRlci5zY3JvbGxMZWZ0ID0gZS50YXJnZXQuc2Nyb2xsTGVmdDtcbiAgICB9KTtcblxuXG5cbiAgICBkaXZNYWluLmFwcGVuZENoaWxkKHRoaXMuZ2V0Q2FudmFzKCkpO1xuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChkaXZNYWluKTtcblxuICAgIHRoaXMuY2hlY2tDYW52YXNCb3VuZHMoKTtcbiAgICB0aGlzLmJlZ2luUmVzaXppbmcoKTtcbn07XG5cbkdyaWQucHJvdG90eXBlLmNoZWNrQ2FudmFzQm91bmRzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGNvbnRhaW5lciA9IHRoaXMuZ2V0Q29udGFpbmVyKCk7XG4gICAgdmFyIGhlYWRlckhlaWdodCA9IHRoaXMuZ2V0Rml4ZWRSb3dIZWlnaHQoKTtcbiAgICB2YXIgY29tcHV0ZWRXaWR0aCA9IHRoaXMuY29tcHV0ZU1haW5BcmVhRnVsbFdpZHRoKCk7XG4gICAgdmFyIGNvbXB1dGVkSGVpZ2h0ID0gdGhpcy5jb21wdXRlTWFpbkFyZWFGdWxsSGVpZ2h0KCkgLSBoZWFkZXJIZWlnaHQ7XG5cbiAgICBpZiAodGhpcy53aWR0aCA9PT0gY29tcHV0ZWRXaWR0aCAmJiB0aGlzLmhlaWdodCA9PT0gY29tcHV0ZWRIZWlnaHQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMudmlld3BvcnQgPSBjb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICB2YXIgaGVhZGVyQ2FudmFzID0gdGhpcy5nZXRIZWFkZXJDYW52YXMoKTtcbiAgICB2YXIgY2FudmFzID0gdGhpcy5nZXRDYW52YXMoKTtcblxuICAgIGhlYWRlckNhbnZhcy5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gICAgaGVhZGVyQ2FudmFzLnNldEF0dHJpYnV0ZSgnd2lkdGgnLCBjb21wdXRlZFdpZHRoKTtcbiAgICBoZWFkZXJDYW52YXMuc2V0QXR0cmlidXRlKCdoZWlnaHQnLCBoZWFkZXJIZWlnaHQpO1xuXG4gICAgY2FudmFzLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgICBjYW52YXMuc3R5bGUudG9wID0gJzFweCc7XG4gICAgY2FudmFzLnNldEF0dHJpYnV0ZSgnd2lkdGgnLCBjb21wdXRlZFdpZHRoKTtcbiAgICBjYW52YXMuc2V0QXR0cmlidXRlKCdoZWlnaHQnLCBjb21wdXRlZEhlaWdodCk7XG5cbiAgICB0aGlzLndpZHRoID0gY29tcHV0ZWRXaWR0aDtcbiAgICB0aGlzLmhlaWdodCA9IGNvbXB1dGVkSGVpZ2h0O1xuXG4gICAgdGhpcy5wYWludEFsbCgpO1xufTtcblxuXG5HcmlkLnByb3RvdHlwZS5nZXRWaWV3cG9ydFZpc2libGVHcmlkQ29vcmRpbmF0ZXMgPSBmdW5jdGlvbigpIHtcblx0Ly90aGlzIGlzIGFuIGltcG9ydGFudCBvcHRpbWl6YXRpb25cbn07XG5cbkdyaWQucHJvdG90eXBlLmNvbXB1dGVNYWluQXJlYUZ1bGxIZWlnaHQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcm93SGVpZ2h0ID0gdGhpcy5nZXRSb3dIZWlnaHQoMCk7XG4gICAgdmFyIG51bVJvd3MgPSB0aGlzLmdldFJvd0NvdW50KCk7XG4gICAgdmFyIHRvdGFsSGVpZ2h0ID0gcm93SGVpZ2h0ICogbnVtUm93cztcbiAgICByZXR1cm4gdG90YWxIZWlnaHQ7XG59O1xuXG5HcmlkLnByb3RvdHlwZS5jb21wdXRlTWFpbkFyZWFGdWxsV2lkdGggPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbnVtQ29scyA9IHRoaXMuZ2V0Q29sdW1uQ291bnQoKTtcbiAgICB2YXIgd2lkdGggPSAwO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbnVtQ29sczsgaSsrKSB7XG4gICAgICAgIHdpZHRoID0gd2lkdGggKyB0aGlzLmdldENvbHVtbldpZHRoKGkpO1xuICAgIH1cbiAgICByZXR1cm4gd2lkdGg7XG59O1xuXG5HcmlkLnByb3RvdHlwZS5zdG9wUmVzaXplVGhyZWFkID0gZnVuY3Rpb24oKSB7XG4gICAgcmVzaXplTG9vcFJ1bm5pbmcgPSBmYWxzZTtcbn07XG5cbkdyaWQucHJvdG90eXBlLnJlc3RhcnRSZXNpemVUaHJlYWQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAocmVzaXplTG9vcFJ1bm5pbmcpIHtcbiAgICAgICAgcmV0dXJuOyAvLyBhbHJlYWR5IHJ1bm5pbmdcbiAgICB9XG4gICAgcmVzaXplTG9vcFJ1bm5pbmcgPSB0cnVlO1xuICAgIHNldEludGVydmFsKHJlc2l6YWJsZXNMb29wRnVuY3Rpb24sIDIwMCk7XG59O1xuXG5HcmlkLnByb3RvdHlwZS5iZWdpblJlc2l6aW5nID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMudGlja1Jlc2l6ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgc2VsZi5jaGVja0NhbnZhc0JvdW5kcygpO1xuICAgIH07XG4gICAgcmVzaXphYmxlcy5wdXNoKHRoaXMudGlja1Jlc2l6ZXIpO1xufTtcblxuR3JpZC5wcm90b3R5cGUuc3RvcFJlc2l6aW5nID0gZnVuY3Rpb24oKSB7XG4gICAgcmVzaXphYmxlcy5zcGxpY2UocmVzaXphYmxlcy5pbmRleE9mKHRoaXMudGlja1Jlc2l6ZXIpLCAxKTtcbn07XG5cbkdyaWQucHJvdG90eXBlLmdldENvbHVtbiA9IGZ1bmN0aW9uKHgpIHtcbiAgICB2YXIgY29sdW1uID0gdGhpcy5nZXRDb2x1bW5zKClbeF07XG4gICAgcmV0dXJuIGNvbHVtbjtcbn07XG5cbkdyaWQucHJvdG90eXBlLmdldFZhbHVlID0gZnVuY3Rpb24oeCwgeSkge1xuICAgIHZhciBtb2RlbCA9IHRoaXMuZ2V0TW9kZWwoKTtcbiAgICB2YXIgY29sdW1uID0gdGhpcy5nZXRDb2x1bW5zKClbeF07XG4gICAgdmFyIGZpZWxkID0gY29sdW1uLmdldEZpZWxkKCk7XG4gICAgdmFyIHZhbHVlID0gbW9kZWwuZ2V0VmFsdWUoZmllbGQsIHkpO1xuICAgIHJldHVybiB2YWx1ZTtcbn07XG5cbkdyaWQucHJvdG90eXBlLmdldEJvdW5kc09mQ2VsbCA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICB2YXIgcngsIHJ5LCByd2lkdGgsIHJoZWlnaHQ7XG4gICAgdmFyIHJvd0hlaWdodCA9IHRoaXMuZ2V0Um93SGVpZ2h0KDApO1xuXG4gICAgcnggPSAwO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgeDsgaSsrKSB7XG4gICAgICAgIHJ4ID0gcnggKyB0aGlzLmdldENvbHVtbldpZHRoKGkpO1xuICAgIH1cbiAgICByeSA9IHJvd0hlaWdodCAqIHk7XG4gICAgcndpZHRoID0gdGhpcy5nZXRDb2x1bW5XaWR0aCh4KTtcbiAgICByaGVpZ2h0ID0gcm93SGVpZ2h0O1xuICAgIHZhciByZXN1bHQgPSB7XG4gICAgICAgIHg6IHJ4LFxuICAgICAgICB5OiByeSxcbiAgICAgICAgd2lkdGg6IHJ3aWR0aCxcbiAgICAgICAgaGVpZ2h0OiByaGVpZ2h0XG4gICAgfTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuR3JpZC5wcm90b3R5cGUuZ2V0Rml4ZWRSb3dIZWlnaHQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdmFsdWUgPSB0aGlzLnJlc29sdmVQcm9wZXJ0eSgnZGVmYXVsdEZpeGVkUm93SGVpZ2h0Jyk7XG4gICAgcmV0dXJuIHZhbHVlO1xufTtcblxuR3JpZC5wcm90b3R5cGUuZ2V0Q29sdW1uV2lkdGggPSBmdW5jdGlvbih4KSB7XG4gICAgdmFyIGNvbHVtbiA9IHRoaXMuZ2V0Q29sdW1uKHgpO1xuICAgIHZhciB2YWx1ZSA9IGNvbHVtbi5nZXRXaWR0aCgpO1xuICAgIHJldHVybiB2YWx1ZTtcbn07XG5cbkdyaWQucHJvdG90eXBlLmdldFJvd0hlaWdodCA9IGZ1bmN0aW9uKHkpIHtcbiAgICB2YXIgdmFsdWUgPSB0aGlzLnJlc29sdmVQcm9wZXJ0eSgnZGVmYXVsdFJvd0hlaWdodCcpO1xuICAgIHJldHVybiB2YWx1ZTtcbn07XG5cbkdyaWQucHJvdG90eXBlLnJlc29sdmVQcm9wZXJ0eSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgdmFsdWUgPSB0aGlzLmdldE9wdGlvbnMoKVtuYW1lXTtcbiAgICByZXR1cm4gdmFsdWU7XG59O1xuXG5HcmlkLnByb3RvdHlwZS5nZXRDb2x1bW5Db3VudCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb2x1bW5zID0gdGhpcy5nZXRDb2x1bW5zKCk7XG4gICAgcmV0dXJuIGNvbHVtbnMubGVuZ3RoXG59O1xuXG5HcmlkLnByb3RvdHlwZS5nZXRSb3dDb3VudCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb2RlbCA9IHRoaXMuZ2V0TW9kZWwoKTtcbiAgICByZXR1cm4gbW9kZWwuZ2V0Um93Q291bnQoKTtcbn07XG5cbkdyaWQucHJvdG90eXBlLmFkZENvbHVtbiA9IGZ1bmN0aW9uKGZpZWxkLCBsYWJlbCwgdHlwZSwgd2lkdGgsIHJlbmRlcmVyKSB7XG4gICAgdmFyIGNvbHVtbnMgPSB0aGlzLmdldENvbHVtbnMoKTtcbiAgICB2YXIgbmV3Q29sID0gbmV3IENvbHVtbih0aGlzLCBmaWVsZCwgbGFiZWwsIHR5cGUsIHdpZHRoLCByZW5kZXJlcik7XG4gICAgY29sdW1ucy5wdXNoKG5ld0NvbCk7XG59O1xuXG5HcmlkLnByb3RvdHlwZS5wYWludEFsbCA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cdHZhciBjb25maWcgPSBPYmplY3QuY3JlYXRlKHRoaXMuZ2V0RGVmYXVsdFByb3BlcnRpZXMoKSk7XG5cblx0Y29uZmlnLmdldFRleHRIZWlnaHQgPSBmdW5jdGlvbihmb250KSB7XG5cdFx0cmV0dXJuIHNlbGYuZ2V0VGV4dEhlaWdodChmb250KTtcblx0fTtcblxuXHRjb25maWcuZ2V0VGV4dFdpZHRoID0gZnVuY3Rpb24oZ2MsIHRleHQpIHtcblx0XHRyZXR1cm4gc2VsZi5nZXRUZXh0V2lkdGgoZ2MsIHRleHQpO1xuXHR9O1xuXG5cbiAgICB2YXIgbnVtQ29scyA9IHRoaXMuZ2V0Q29sdW1uQ291bnQoKTtcbiAgICB2YXIgbnVtUm93cyA9IHRoaXMuZ2V0Um93Q291bnQoKTtcblx0dGhpcy5wYWludE1haW5BcmVhKGNvbmZpZywgbnVtQ29scywgbnVtUm93cyk7XG5cdHRoaXMucGFpbnRIZWFkZXJzKGNvbmZpZywgbnVtQ29scywgMSk7XG59XG5cbkdyaWQucHJvdG90eXBlLnBhaW50TWFpbkFyZWEgPSBmdW5jdGlvbihjb25maWcsIG51bUNvbHMsIG51bVJvd3MpIHtcbiAgICB0cnkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBjb250ZXh0ID0gdGhpcy5nZXRDb250ZXh0KCk7XG4gICAgICAgIGNvbnRleHQuc2F2ZSgpO1xuICAgICAgICBmb3IgKHZhciB4ID0gMDsgeCA8IG51bUNvbHM7IHgrKykge1xuICAgICAgICAgICAgZm9yICh2YXIgeSA9IDA7IHkgPCBudW1Sb3dzOyB5KyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhaW50Q2VsbChjb250ZXh0LCB4LCB5LCBjb25maWcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnRleHQucmVzdG9yZSgpO1xuICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICB9XG59O1xuXG5cbkdyaWQucHJvdG90eXBlLnBhaW50SGVhZGVycyA9IGZ1bmN0aW9uKGNvbmZpZywgbnVtQ29scywgbnVtUm93cykge1xuICAgIHRyeSB7XG4gICAgXHRjb25maWcuaGFsaWduID0gJ2NlbnRlcic7XG4gICAgXHRjb25maWcuY2VsbFBhZGRpbmcgPSAnMHB4JztcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgY29udGV4dCA9IHRoaXMuZ2V0SGVhZGVyQ29udGV4dCgpO1xuICAgICAgICBjb250ZXh0LnNhdmUoKTtcbiAgICAgICAgZm9yICh2YXIgeCA9IDA7IHggPCBudW1Db2xzOyB4KyspIHtcbiAgICAgICAgICAgIGZvciAodmFyIHkgPSAwOyB5IDwgbnVtUm93czsgeSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYWludEhlYWRlckNlbGwoY29udGV4dCwgeCwgeSwgY29uZmlnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb250ZXh0LnJlc3RvcmUoKTtcbiAgICAgICAgY29uc29sZS5sb2coZSk7XG4gICAgfVxufTtcblxuR3JpZC5wcm90b3R5cGUucGFpbnRDZWxsID0gZnVuY3Rpb24oY29udGV4dCwgeCwgeSwgY29uZmlnKSB7XG4gICAgdmFyIG1vZGVsID0gdGhpcy5nZXRNb2RlbCgpO1xuICAgIHZhciBib3VuZHMgPSB0aGlzLmdldEJvdW5kc09mQ2VsbCh4LCB5KTtcbiAgICB2YXIgY29sdW1uID0gdGhpcy5nZXRDb2x1bW4oeCk7XG4gICAgdmFyIHJlbmRlcmVyID0gY29sdW1uLmdldFJlbmRlcmVyKCk7XG4gICAgdmFyIHZhbHVlID0gdGhpcy5nZXRWYWx1ZSh4LCB5KTtcbiAgICBjb25maWcudmFsdWUgPSB2YWx1ZTtcbiAgICBjb25maWcueCA9IHg7XG4gICAgY29uZmlnLnkgPSB5O1xuICAgIGNvbmZpZy5ib3VuZHMgPSBib3VuZHM7XG4gICAgcmVuZGVyZXIoY29udGV4dCwgY29uZmlnKTtcbn07XG5cblxuR3JpZC5wcm90b3R5cGUucGFpbnRIZWFkZXJDZWxsID0gZnVuY3Rpb24oY29udGV4dCwgeCwgeSwgY29uZmlnKSB7XG4gICAgdmFyIGJvdW5kcyA9IHRoaXMuZ2V0Qm91bmRzT2ZDZWxsKHgsIHkpO1xuICAgIHZhciBjb2x1bW4gPSB0aGlzLmdldENvbHVtbih4KTtcbiAgICB2YXIgcmVuZGVyZXIgPSBjb2x1bW4uZ2V0UmVuZGVyZXIoKTtcbiAgICB2YXIgdmFsdWUgPSBjb2x1bW4uZ2V0TGFiZWwoKTtcbiAgICBjb25maWcudmFsdWUgPSB2YWx1ZTtcbiAgICBjb25maWcueCA9IHg7XG4gICAgY29uZmlnLnkgPSB5O1xuICAgIGNvbmZpZy5ib3VuZHMgPSBib3VuZHM7XG4gICAgcmVuZGVyZXIoY29udGV4dCwgY29uZmlnKTtcbn07XG5cbkdyaWQucHJvdG90eXBlLmdldERlZmF1bHRDZWxsUmVuZGVyZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZGVmYXVsdGNlbGxyZW5kZXJlcjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihkb21FbGVtZW50LCBtb2RlbCkge1xuICAgIHJldHVybiBuZXcgR3JpZChkb21FbGVtZW50LCBtb2RlbCk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5cbnZhciBHcmlkTW9kZWwgPSBmdW5jdGlvbihqc29uRGF0YSkge1xuXG4gICAgLy90aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZW4gYnkgZ3JpZCBpdHNlbGY7XG4gICAgLy9pZiBjb29yZGluYXRlcyAtMSwgLTEgYXJlIHVzZWQsIGl0IG1lYW5zIFxuICAgIC8vcmVwYWludCB0aGUgd2hvbGUgdmlzaWJsZSBncmlkXG4gICAgdGhpcy5jaGFuZ2VkID0gZnVuY3Rpb24oeCwgeSkge307XG5cbiAgICB0aGlzLmdldERhdGEgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGpzb25EYXRhO1xuICAgIH07XG5cbiAgICB0aGlzLnNldERhdGEgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIGpzb25EYXRhID0gZGF0YTtcbiAgICB9XG5cbn07XG5cbkdyaWRNb2RlbC5wcm90b3R5cGUuZ2V0VmFsdWUgPSBmdW5jdGlvbihmaWVsZCwgeSkge1xuICAgIHZhciBvYmogPSB0aGlzLmdldERhdGEoKVt5XTtcbiAgICB2YXIgdmFsdWUgPSBvYmpbZmllbGRdO1xuICAgIHJldHVybiB2YWx1ZTtcbn07XG5cbkdyaWRNb2RlbC5wcm90b3R5cGUuZ2V0Um93Q291bnQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5nZXREYXRhKCkubGVuZ3RoO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBHcmlkTW9kZWw7Il19
