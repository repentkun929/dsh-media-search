import { defineTool } from "@deepseek-ai/dsh-tools";
import { spawn } from "node:child_process";
import { BUNDLED_SKILL_RANK } from "@deepseek-ai/dsh-skill";

//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __exportAll = (all, symbols) => {
	let target = {};
	for (var name$1 in all) {
		__defProp(target, name$1, {
			get: all[name$1],
			enumerable: true
		});
	}
	if (symbols) {
		__defProp(target, Symbol.toStringTag, { value: "Module" });
	}
	return target;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) {
				__defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
		}
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __toCommonJS = (mod) => __hasOwnProp.call(mod, "module.exports") ? mod["module.exports"] : __copyProps(__defProp({}, "__esModule", { value: true }), mod);

//#endregion
//#region node_modules/.pnpm/@deepseek-ai+cosmokit@1.8.5/node_modules/@deepseek-ai/cosmokit/lib/index.js
var lib_exports = /* @__PURE__ */ __exportAll({
	Binary: () => Binary,
	Time: () => Time,
	arrayBufferToBase64: () => arrayBufferToBase64,
	arrayBufferToHex: () => arrayBufferToHex,
	base64ToArrayBuffer: () => base64ToArrayBuffer,
	camelCase: () => camelCase,
	camelize: () => camelize,
	capitalize: () => capitalize,
	clone: () => clone,
	contain: () => contain,
	createVolatile: () => createVolatile,
	deduplicate: () => deduplicate,
	deepEqual: () => deepEqual,
	defineProperty: () => defineProperty,
	difference: () => difference,
	filterKeys: () => filterKeys,
	formatProperty: () => formatProperty,
	hexToArrayBuffer: () => hexToArrayBuffer,
	hyphenate: () => hyphenate,
	intersection: () => intersection,
	is: () => is,
	isNonNullable: () => isNonNullable,
	isNullable: () => isNullable,
	isPlainObject: () => isPlainObject,
	isVolatile: () => isVolatile,
	makeArray: () => makeArray,
	mapValues: () => mapValues,
	noop: () => noop,
	omit: () => omit,
	paramCase: () => paramCase,
	pick: () => pick,
	remove: () => remove,
	sanitize: () => sanitize,
	snakeCase: () => snakeCase,
	trimSlash: () => trimSlash,
	uncapitalize: () => uncapitalize,
	union: () => union,
	updateVolatile: () => updateVolatile,
	valueMap: () => mapValues,
	volatileEntries: () => volatileEntries
});
/** No-op callback returning `undefined` at runtime and `any` at type level. */
function noop() {}
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true when a value is neither `null` nor `undefined`. */
function isNonNullable(value) {
	return !isNullable(value);
}
/** Return true for non-array object values. */
function isPlainObject(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}
/** Omit selected keys from a shallow object copy. */
function omit(source, keys) {
	if (!keys) return { ...source };
	const result = { ...source };
	for (const key of keys) Reflect.deleteProperty(result, key);
	return result;
}
/** Define a non-enumerable writable property and return the object. */
function defineProperty(object, key, value) {
	return Object.defineProperty(object, key, {
		writable: true,
		value,
		enumerable: false
	});
}
/** Return true when every item in `array2` is present in `array1`. */
function contain(array1, array2) {
	return array2.every((item) => array1.includes(item));
}
/** Return items that appear in both arrays. */
function intersection(array1, array2) {
	return array1.filter((item) => array2.includes(item));
}
/** Return items from `array1` that do not appear in `array2`. */
function difference(array1, array2) {
	return array1.filter((item) => !array2.includes(item));
}
/** Return the set-union of two arrays while preserving first occurrence order. */
function union(array1, array2) {
	return Array.from(new Set([...array1, ...array2]));
}
/** Remove duplicate values while preserving first occurrence order. */
function deduplicate(array) {
	return [...new Set(array)];
}
/** Remove one item from an array and report whether it was found. */
function remove(list, item) {
	const index = list?.indexOf(item);
	if (index >= 0) {
		list.splice(index, 1);
		return true;
	} else return false;
}
/** Normalize nullish, scalar, or array input to an array. */
function makeArray(source) {
	return Array.isArray(source) ? source : isNullable(source) ? [] : [source];
}
function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
	if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
	if (value === null || typeof value !== "object") return value;
	if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
	ancestors.add(value);
	try {
		if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshot(item, ancestors)));
		if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("volatile config objects must be plain objects or arrays");
		return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)])));
	} finally {
		ancestors.delete(value);
	}
}
/**
* Create a detached reference containing an immutable copy of the supplied data.
* @param value - validated config data; class instances and functions are unsupported.
* @returns a reference whose value is updated only by its owning runtime.
*/
function createVolatile(value) {
	let current = snapshot(value);
	return Object.freeze({
		get: () => current,
		[write]: (value$1) => {
			current = value$1;
		}
	});
}
/**
* Identify references across ESM/CJS copies of the shared library.
* @param value - a parsed config value.
* @returns whether the value implements the shared reference protocol.
*/
function isVolatile(value) {
	return typeof value === "object" && value !== null && write in value;
}
/**
* Collect config references without descending into their snapshots or opaque objects.
* @internal
* @param value - parsed config; cyclic ordinary fields are visited once per path.
* @returns references and their object-key paths, including an empty path for a root reference.
*/
function volatileEntries(value) {
	const ancestors = /* @__PURE__ */ new Set();
	function visit(value$1, path) {
		if (isVolatile(value$1)) return [{
			path,
			ref: value$1
		}];
		if (!value$1 || typeof value$1 !== "object" || ancestors.has(value$1)) return [];
		if (!Array.isArray(value$1) && Object.getPrototypeOf(value$1) !== Object.prototype && Object.getPrototypeOf(value$1) !== null) return [];
		ancestors.add(value$1);
		try {
			return Object.entries(value$1).flatMap(([key, child]) => visit(child, [...path, key]));
		} finally {
			ancestors.delete(value$1);
		}
	}
	return visit(value, []);
}
/**
* Commit an already validated immutable snapshot from another reference.
* @internal
* @param target - the owning plugin's stable reference.
* @param source - a newly parsed candidate reference.
*/
function updateVolatile(target, source) {
	target[write](source.get());
}
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value$1) => is(type, value$1);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result$1 = [];
		refs.set(source, result$1);
		source.forEach((value, index) => {
			result$1[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result$1;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/**
* Compare values recursively, treating two volatile references as equal regardless of value.
* Strict comparison distinguishes null/undefined, treats opaque objects by identity,
* compares URLs by normalized href, treats array holes as undefined, and considers distinct cyclic structures unequal.
* @param a - first value.
* @param b - second value.
* @param strict - whether to require strict data equality outside volatile references.
* @returns whether the values compare equal.
*/
function deepEqual(a, b, strict) {
	const ancestors = /* @__PURE__ */ new Set();
	function compare(a$1, b$1) {
		if (a$1 === b$1) return true;
		if (isVolatile(a$1) || isVolatile(b$1)) return isVolatile(a$1) && isVolatile(b$1);
		if (!strict && isNullable(a$1) && isNullable(b$1)) return true;
		if (typeof a$1 !== typeof b$1 || typeof a$1 !== "object" || !a$1 || !b$1) return false;
		if (ancestors.has(a$1)) return false;
		function check(test, then) {
			return test(a$1) ? test(b$1) ? then(a$1, b$1) : false : test(b$1) ? false : void 0;
		}
		ancestors.add(a$1);
		try {
			return check(Array.isArray, (a$2, b$2) => {
				if (a$2.length !== b$2.length) return false;
				for (let index = 0; index < a$2.length; index++) if (!compare(a$2[index], b$2[index])) return false;
				return true;
			}) ?? check(is("Date"), (a$2, b$2) => a$2.valueOf() === b$2.valueOf()) ?? check(is("URL"), (a$2, b$2) => a$2.href === b$2.href) ?? check(is("RegExp"), (a$2, b$2) => a$2.source === b$2.source && a$2.flags === b$2.flags) ?? check(isArrayBufferLike, (a$2, b$2) => {
				if (a$2.byteLength !== b$2.byteLength) return false;
				const viewA = new Uint8Array(a$2);
				const viewB = new Uint8Array(b$2);
				for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
				return true;
			}) ?? ((!strict || [a$1, b$1].every((value) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) && Object.keys({
				...a$1,
				...b$1
			}).every((key) => compare(a$1[key], b$1[key])));
		} finally {
			ancestors.delete(a$1);
		}
	}
	return compare(a, b);
}
/** Uppercase the first character of a string. */
function capitalize(source) {
	return source.charAt(0).toUpperCase() + source.slice(1);
}
/** Lowercase the first character of a string. */
function uncapitalize(source) {
	return source.charAt(0).toLowerCase() + source.slice(1);
}
/** Convert dash or underscore delimited text to camelCase. */
function camelCase(source) {
	return source.replace(/[_-][a-z]/g, (str$1) => str$1.slice(1).toUpperCase());
}
function tokenize(source, delimiters, delimiter) {
	const output = [];
	let state = 0;
	for (let i = 0; i < source.length; i++) {
		const code = source.charCodeAt(i);
		if (code >= 65 && code <= 90) {
			if (state === 1) {
				const next = source.charCodeAt(i + 1);
				if (next >= 97 && next <= 122) output.push(delimiter);
				output.push(code + 32);
			} else {
				if (state !== 0) output.push(delimiter);
				output.push(code + 32);
			}
			state = 1;
		} else if (code >= 97 && code <= 122) {
			output.push(code);
			state = 2;
		} else if (delimiters.includes(code)) {
			if (state !== 0) output.push(delimiter);
			state = 0;
		} else output.push(code);
	}
	return String.fromCharCode(...output);
}
/** Convert text to dash-delimited parameter case. */
function paramCase(source) {
	return tokenize(source, [45, 95], 45);
}
/** Convert text to underscore-delimited snake case. */
function snakeCase(source) {
	return tokenize(source, [45, 95], 95);
}
/** Format a property key as a JavaScript member access suffix. */
function formatProperty(key) {
	if (typeof key !== "string") return `[${key.toString()}]`;
	return /^[a-z_$][\w$]*$/i.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}
/** Remove one trailing slash from a path string. */
function trimSlash(source) {
	return source.replace(/\/$/, "");
}
/** Ensure a path starts with `/` and has no trailing slash. */
function sanitize(source) {
	if (!source.startsWith("/")) source = "/" + source;
	return trimSlash(source);
}
var write, Binary, base64ToArrayBuffer, arrayBufferToBase64, hexToArrayBuffer, arrayBufferToHex, camelize, hyphenate, Time;
var init_lib = __esmMin((() => {
	write = Symbol.for("cosmokit.volatile.write");
	;
	(function(Binary$1) {
		Binary$1.is = isArrayBufferLike;
		Binary$1.isSource = isArrayBufferSource;
		function fromSource(source) {
			if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
			else return source;
		}
		Binary$1.fromSource = fromSource;
		function toBase64(source) {
			source = fromSource(source);
			if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
			let binary = "";
			const bytes = new Uint8Array(source);
			for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
			return btoa(binary);
		}
		Binary$1.toBase64 = toBase64;
		function fromBase64(source) {
			if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
			return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
		}
		Binary$1.fromBase64 = fromBase64;
		function toHex(source) {
			source = fromSource(source);
			if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
			return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
		}
		Binary$1.toHex = toHex;
		function fromHex(source) {
			if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
			const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
			const buffer = [];
			for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
			return Uint8Array.from(buffer).buffer;
		}
		Binary$1.fromHex = fromHex;
	})(Binary || (Binary = {}));
	base64ToArrayBuffer = Binary.fromBase64;
	arrayBufferToBase64 = Binary.toBase64;
	hexToArrayBuffer = Binary.fromHex;
	arrayBufferToHex = Binary.toHex;
	camelize = camelCase;
	hyphenate = paramCase;
	;
	(function(Time$1) {
		Time$1.millisecond = 1;
		Time$1.second = 1e3;
		Time$1.minute = Time$1.second * 60;
		Time$1.hour = Time$1.minute * 60;
		Time$1.day = Time$1.hour * 24;
		Time$1.week = Time$1.day * 7;
		let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
		function setTimezoneOffset(offset) {
			timezoneOffset = offset;
		}
		Time$1.setTimezoneOffset = setTimezoneOffset;
		function getTimezoneOffset() {
			return timezoneOffset;
		}
		Time$1.getTimezoneOffset = getTimezoneOffset;
		function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
			if (typeof date === "number") date = new Date(date);
			if (offset === void 0) offset = timezoneOffset;
			return Math.floor((date.valueOf() / Time$1.minute - offset) / 1440);
		}
		Time$1.getDateNumber = getDateNumber;
		function fromDateNumber(value, offset) {
			const date = new Date(value * Time$1.day);
			if (offset === void 0) offset = timezoneOffset;
			return new Date(+date + offset * Time$1.minute);
		}
		Time$1.fromDateNumber = fromDateNumber;
		const numeric = /\d+(?:\.\d+)?/.source;
		const timeRegExp = /* @__PURE__ */ new RegExp(`^${[
			"w(?:eek(?:s)?)?",
			"d(?:ay(?:s)?)?",
			"h(?:our(?:s)?)?",
			"m(?:in(?:ute)?(?:s)?)?",
			"s(?:ec(?:ond)?(?:s)?)?"
		].map((unit) => `(${numeric}${unit})?`).join("")}$`);
		function parseTime(source) {
			const capture = timeRegExp.exec(source);
			if (!capture) return 0;
			return (parseFloat(capture[1]) * Time$1.week || 0) + (parseFloat(capture[2]) * Time$1.day || 0) + (parseFloat(capture[3]) * Time$1.hour || 0) + (parseFloat(capture[4]) * Time$1.minute || 0) + (parseFloat(capture[5]) * Time$1.second || 0);
		}
		Time$1.parseTime = parseTime;
		function parseDate(date) {
			const parsed = parseTime(date);
			if (parsed) date = Date.now() + parsed;
			else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
			else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
			return date ? new Date(date) : /* @__PURE__ */ new Date();
		}
		Time$1.parseDate = parseDate;
		function format(ms) {
			const abs = Math.abs(ms);
			if (abs >= Time$1.day - Time$1.hour / 2) return Math.round(ms / Time$1.day) + "d";
			else if (abs >= Time$1.hour - Time$1.minute / 2) return Math.round(ms / Time$1.hour) + "h";
			else if (abs >= Time$1.minute - Time$1.second / 2) return Math.round(ms / Time$1.minute) + "m";
			else if (abs >= Time$1.second) return Math.round(ms / Time$1.second) + "s";
			return ms + "ms";
		}
		Time$1.format = format;
		function toDigits(source, length = 2) {
			return source.toString().padStart(length, "0");
		}
		Time$1.toDigits = toDigits;
		function template(template$1, time = /* @__PURE__ */ new Date()) {
			return template$1.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
		}
		Time$1.template = template;
	})(Time || (Time = {}));
}));

//#endregion
//#region node_modules/.pnpm/@deepseek-ai+schemastery@3.18.4/node_modules/@deepseek-ai/schemastery/lib/index.cjs
var require_lib = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let _deepseek_ai_cosmokit = (init_lib(), __toCommonJS(lib_exports));
	const kSchema = Symbol.for("schemastery");
	const kValidationError = Symbol.for("ValidationError");
	globalThis.__schemastery_index__ ??= 0;
	globalThis.__schemastery_refs__ = void 0;
	var ValidationError = class extends TypeError {
		options;
		name = "ValidationError";
		constructor(message, options) {
			let prefix = "$";
			for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
			else if (typeof segment === "number") prefix += "[" + segment + "]";
			else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
			if (prefix.startsWith(".")) prefix = prefix.slice(1);
			super((prefix === "$" ? "" : `${prefix} `) + message);
			this.options = options;
		}
		static is(error) {
			return !!error?.[kValidationError];
		}
	};
	Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
	const Schema = function(options) {
		const schema = function(data, options$1 = {}) {
			return Schema.resolve(data, schema, options$1)[0];
		};
		if (options.refs) {
			const refs = (0, _deepseek_ai_cosmokit.valueMap)(options.refs, (options$1) => new Schema(options$1));
			const getRef = (uid) => refs[uid];
			for (const key in refs) {
				const options$1 = refs[key];
				options$1.sKey = getRef(options$1.sKey);
				options$1.inner = getRef(options$1.inner);
				options$1.list = options$1.list && options$1.list.map(getRef);
				options$1.dict = options$1.dict && (0, _deepseek_ai_cosmokit.valueMap)(options$1.dict, getRef);
			}
			return refs[options.uid];
		}
		Object.assign(schema, options);
		if (typeof schema.callback === "string") try {
			schema.callback = new Function("return " + schema.callback)();
		} catch {}
		Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
		Object.setPrototypeOf(schema, Schema.prototype);
		schema.meta ||= {};
		schema.toString = schema.toString.bind(schema);
		return schema;
	};
	Schema.prototype = Object.create(Function.prototype);
	Schema.prototype[kSchema] = true;
	Object.defineProperty(Schema.prototype, "~standard", { get() {
		return {
			version: 1,
			vendor: "schemastery",
			validate: (value) => {
				try {
					return { value: Schema.resolve(value, this, {})[0] };
				} catch (error) {
					if (ValidationError.is(error)) return { issues: [{
						message: error.message,
						path: error.options.path
					}] };
					throw error;
				}
			}
		};
	} });
	Schema.ValidationError = ValidationError;
	Schema.prototype.toJSON = function toJSON() {
		if (globalThis.__schemastery_refs__) {
			globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
			return this.uid;
		}
		globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
		globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
		const result = {
			uid: this.uid,
			refs: globalThis.__schemastery_refs__
		};
		globalThis.__schemastery_refs__ = void 0;
		return result;
	};
	Schema.prototype.set = function set(key, value) {
		this.dict[key] = value;
		return this;
	};
	Schema.prototype.push = function push(value) {
		this.list.push(value);
		return this;
	};
	function mergeDesc(original, messages) {
		const result = typeof original === "string" ? { "": original } : { ...original };
		for (const locale in messages) {
			const value = messages[locale];
			if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
			else if (typeof value === "string") result[locale] = value;
		}
		return result;
	}
	function getInner(value) {
		return value?.$value ?? value?.$inner;
	}
	function extractKeys(data) {
		return (0, _deepseek_ai_cosmokit.filterKeys)(data ?? {}, (key) => !key.startsWith("$"));
	}
	Schema.prototype.i18n = function i18n(messages) {
		const schema = Schema(this);
		const desc = mergeDesc(schema.meta.description, messages);
		if (Object.keys(desc).length) schema.meta.description = desc;
		if (schema.dict) schema.dict = (0, _deepseek_ai_cosmokit.valueMap)(schema.dict, (inner, key) => {
			return inner.i18n((0, _deepseek_ai_cosmokit.valueMap)(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
		});
		if (schema.list) schema.list = schema.list.map((inner, index) => {
			return inner.i18n((0, _deepseek_ai_cosmokit.valueMap)(messages, (data = {}) => {
				if (Array.isArray(getInner(data))) return getInner(data)[index];
				if (Array.isArray(data)) return data[index];
				return extractKeys(data);
			}));
		});
		if (schema.inner) schema.inner = schema.inner.i18n((0, _deepseek_ai_cosmokit.valueMap)(messages, (data) => {
			if (getInner(data)) return getInner(data);
			return extractKeys(data);
		}));
		if (schema.sKey) schema.sKey = schema.sKey.i18n((0, _deepseek_ai_cosmokit.valueMap)(messages, (data) => data?.$key));
		return schema;
	};
	Schema.prototype.extra = function extra(key, value) {
		const schema = Schema(this);
		schema.meta = {
			...schema.meta,
			[key]: value
		};
		return schema;
	};
	for (const key of [
		"required",
		"disabled",
		"collapse",
		"hidden",
		"loose"
	]) Object.assign(Schema.prototype, { [key](value = true) {
		const schema = Schema(this);
		schema.meta = {
			...schema.meta,
			[key]: value
		};
		return schema;
	} });
	Schema.prototype.deprecated = function deprecated() {
		const schema = Schema(this);
		schema.meta.badges ||= [];
		schema.meta.badges.push({
			text: "deprecated",
			type: "danger"
		});
		return schema;
	};
	Schema.prototype.experimental = function experimental() {
		const schema = Schema(this);
		schema.meta.badges ||= [];
		schema.meta.badges.push({
			text: "experimental",
			type: "warning"
		});
		return schema;
	};
	Schema.prototype.pattern = function pattern(regexp) {
		const schema = Schema(this);
		const pattern$1 = (0, _deepseek_ai_cosmokit.pick)(regexp, ["source", "flags"]);
		schema.meta = {
			...schema.meta,
			pattern: pattern$1
		};
		return schema;
	};
	Schema.prototype.simplify = function simplify(value) {
		if ((0, _deepseek_ai_cosmokit.isVolatile)(value)) value = value.get();
		if ((0, _deepseek_ai_cosmokit.deepEqual)(value, this.meta.default, this.type === "dict")) return null;
		if ((0, _deepseek_ai_cosmokit.isNullable)(value)) return value;
		if (this.type === "object" || this.type === "dict") {
			const result = {};
			for (const key in value) {
				const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
				if (this.type === "dict" || !(0, _deepseek_ai_cosmokit.isNullable)(item)) result[key] = item;
			}
			if ((0, _deepseek_ai_cosmokit.deepEqual)(result, this.meta.default, this.type === "dict")) return null;
			return result;
		} else if (this.type === "array" || this.type === "tuple") {
			const result = [];
			value.forEach((value$1, index) => {
				const schema = this.type === "array" ? this.inner : this.list[index];
				const item = schema ? schema.simplify(value$1) : value$1;
				result.push(item);
			});
			return result;
		} else if (this.type === "intersect") {
			const result = {};
			for (const item of this.list) Object.assign(result, item.simplify(value));
			return result;
		} else if (this.type === "union") for (const schema of this.list) try {
			Schema.resolve(value, schema, {});
			return schema.simplify(value);
		} catch {}
		return value;
	};
	Schema.prototype.toString = function toString(inline) {
		return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
	};
	Schema.prototype.role = function role(role$1, extra) {
		const schema = Schema(this);
		schema.meta = {
			...schema.meta,
			role: role$1,
			extra
		};
		return schema;
	};
	for (const key of [
		"default",
		"link",
		"comment",
		"description",
		"max",
		"min",
		"step"
	]) Object.assign(Schema.prototype, { [key](value) {
		const schema = Schema(this);
		schema.meta = {
			...schema.meta,
			[key]: value
		};
		return schema;
	} });
	Schema.prototype.volatile = function volatile() {
		if (this.meta.volatile) throw new TypeError("volatile schema is already wrapped");
		return this.extra("volatile", true);
	};
	const resolvers = {};
	const checkedVolatile = Symbol("checked-volatile-schema");
	function validateVolatileSchema(schema, path = [], blocked = false, seen = /* @__PURE__ */ new Map()) {
		const states = seen.get(schema) ?? /* @__PURE__ */ new Set();
		if (states.has(blocked)) return;
		states.add(blocked);
		seen.set(schema, states);
		if (schema.meta?.volatile && blocked) throw new ValidationError("volatile fields require a fixed object path without an enclosing volatile field", { path });
		const nested = blocked || !!schema.meta?.volatile;
		if (schema.dict) for (const [key, child] of Object.entries(schema.dict)) validateVolatileSchema(child, [...path, key], nested, seen);
		if (schema.sKey) validateVolatileSchema(schema.sKey, [...path, "<key>"], true, seen);
		if (schema.inner && (schema.type !== "lazy" || schema.inner[kSchema])) validateVolatileSchema(schema.inner, [...path, "*"], true, seen);
		if (schema.list) for (let index = 0; index < schema.list.length; index++) validateVolatileSchema(schema.list[index], [...path, String(index)], true, seen);
	}
	Schema.extend = function extend(type, resolve) {
		resolvers[type] = resolve;
	};
	Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
		if (!schema) return [data];
		if (!options[checkedVolatile]) {
			validateVolatileSchema(schema, options.path);
			options = {
				...options,
				[checkedVolatile]: true
			};
		}
		if (schema.meta?.volatile) {
			const inner = Schema(schema);
			inner.meta = {
				...schema.meta,
				volatile: false
			};
			const [value, adapted] = Schema.resolve(data, inner, options, strict);
			try {
				return [(0, _deepseek_ai_cosmokit.createVolatile)(value), adapted];
			} catch (error) {
				throw new ValidationError(error instanceof Error ? error.message : String(error), options);
			}
		}
		if (options.ignore?.(data, schema)) return [data];
		if ((0, _deepseek_ai_cosmokit.isNullable)(data) && schema.type !== "lazy") {
			if (schema.meta.required) throw new ValidationError(`missing required value`, options);
			let current = schema;
			let fallback = schema.meta.default;
			while (current?.type === "intersect" && (0, _deepseek_ai_cosmokit.isNullable)(fallback)) {
				current = current.list[0];
				fallback = current?.meta.default;
			}
			if ((0, _deepseek_ai_cosmokit.isNullable)(fallback)) return [data];
			data = (0, _deepseek_ai_cosmokit.clone)(fallback);
		}
		const callback = resolvers[schema.type];
		if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
		try {
			return callback(data, schema, options, strict);
		} catch (error) {
			if (!schema.meta.loose) throw error;
			return [schema.meta.default];
		}
	};
	Schema.from = function from(source) {
		if ((0, _deepseek_ai_cosmokit.isNullable)(source)) return Schema.any();
		else if ([
			"string",
			"number",
			"boolean"
		].includes(typeof source)) return Schema.const(source).required();
		else if (source[kSchema]) return source;
		else if (typeof source === "function") switch (source) {
			case String: return Schema.string().required();
			case Number: return Schema.number().required();
			case Boolean: return Schema.boolean().required();
			case Function: return Schema.function().required();
			default: return Schema.is(source).required();
		}
		else throw new TypeError(`cannot infer schema from ${source}`);
	};
	Schema.lazy = function lazy(builder) {
		const toJSON = () => {
			if (!schema.inner[kSchema]) {
				schema.inner = schema.builder();
				schema.inner.meta = {
					...schema.meta,
					...schema.inner.meta
				};
			}
			return schema.inner.toJSON();
		};
		const schema = new Schema({
			type: "lazy",
			builder,
			inner: { toJSON }
		});
		return schema;
	};
	Schema.natural = function natural() {
		return Schema.number().step(1).min(0);
	};
	Schema.percent = function percent() {
		return Schema.number().step(.01).min(0).max(1).role("slider");
	};
	Schema.date = function date() {
		return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
			const date$1 = new Date(value);
			if (isNaN(+date$1)) throw new ValidationError(`invalid date "${value}"`, options);
			return date$1;
		}, true)]);
	};
	Schema.regExp = function regExp(flag = "") {
		return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
			try {
				return new RegExp(value, flag);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)]);
	};
	Schema.arrayBuffer = function arrayBuffer(encoding) {
		return Schema.union([
			Schema.is(ArrayBuffer),
			Schema.is(SharedArrayBuffer),
			Schema.transform(Schema.any(), (value, options) => {
				if (_deepseek_ai_cosmokit.Binary.isSource(value)) return _deepseek_ai_cosmokit.Binary.fromSource(value);
				throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
			}, true),
			...encoding ? [Schema.transform(Schema.string(), (value, options) => {
				try {
					return encoding === "base64" ? _deepseek_ai_cosmokit.Binary.fromBase64(value) : _deepseek_ai_cosmokit.Binary.fromHex(value);
				} catch (e) {
					throw new ValidationError(e.message, options);
				}
			}, true)] : []
		]);
	};
	Schema.extend("lazy", (data, schema, options, strict) => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
			validateVolatileSchema(schema.inner, options.path, true);
		}
		return Schema.resolve(data, schema.inner, options, strict);
	});
	Schema.extend("any", (data) => {
		return [data];
	});
	Schema.extend("never", (data, _, options) => {
		throw new ValidationError(`expected nullable but got ${data}`, options);
	});
	Schema.extend("const", (data, { value }, options) => {
		if ((0, _deepseek_ai_cosmokit.deepEqual)(data, value)) return [value];
		throw new ValidationError(`expected ${value} but got ${data}`, options);
	});
	function checkWithinRange(data, meta, description, options, skipMin = false) {
		const { max = Infinity, min = -Infinity } = meta;
		if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
		if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
	}
	Schema.extend("string", (data, { meta }, options) => {
		if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
		if (meta.pattern) {
			const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
			if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
		}
		checkWithinRange(data.length, meta, "string length", options);
		return [data];
	});
	function decimalShift(data, digits) {
		const str$1 = data.toString();
		if (str$1.includes("e")) return data * Math.pow(10, digits);
		const index = str$1.indexOf(".");
		if (index === -1) return data * Math.pow(10, digits);
		const frac = str$1.slice(index + 1);
		const integer = str$1.slice(0, index);
		if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
		return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
	}
	function isMultipleOf(data, min, step) {
		step = Math.abs(step);
		if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
		const index = step.toString().indexOf(".");
		const digits = step.toString().slice(index + 1).length;
		return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
	}
	Schema.extend("number", (data, { meta }, options) => {
		if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
		checkWithinRange(data, meta, "number", options);
		const { step } = meta;
		if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
		return [data];
	});
	Schema.extend("boolean", (data, _, options) => {
		if (typeof data === "boolean") return [data];
		throw new ValidationError(`expected boolean but got ${data}`, options);
	});
	Schema.extend("bitset", (data, { bits, meta }, options) => {
		let value = 0, keys = [];
		if (typeof data === "number") {
			value = data;
			for (const key in bits) if (data & bits[key]) keys.push(key);
		} else if (Array.isArray(data)) {
			keys = data;
			for (const key of keys) {
				if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
				if (key in bits) value |= bits[key];
			}
		} else throw new ValidationError(`expected number or array but got ${data}`, options);
		if (value === meta.default) return [value];
		return [value, keys];
	});
	Schema.extend("function", (data, _, options) => {
		if (typeof data === "function") return [data];
		throw new ValidationError(`expected function but got ${data}`, options);
	});
	Schema.extend("is", (data, { constructor }, options) => {
		if (typeof constructor === "function") {
			if (data instanceof constructor) return [data];
			throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
		} else {
			if ((0, _deepseek_ai_cosmokit.isNullable)(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
			let prototype = Object.getPrototypeOf(data);
			while (prototype) {
				if (prototype.constructor?.name === constructor) return [data];
				prototype = Object.getPrototypeOf(prototype);
			}
			throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		}
	});
	function property(data, key, schema, options) {
		try {
			const [value, adapted] = Schema.resolve(data[key], schema, {
				...options,
				path: [...options.path || [], key]
			});
			if (adapted !== void 0) data[key] = adapted;
			return value;
		} catch (e) {
			if (!options?.autofix) throw e;
			delete data[key];
			return schema.meta.volatile ? (0, _deepseek_ai_cosmokit.createVolatile)(schema.meta.default) : schema.meta.default;
		}
	}
	Schema.extend("array", (data, { inner, meta }, options) => {
		if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
		checkWithinRange(data.length, meta, "array length", options, !(0, _deepseek_ai_cosmokit.isNullable)(inner.meta.default));
		return [data.map((_, index) => property(data, index, inner, options))];
	});
	Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
		if (!(0, _deepseek_ai_cosmokit.isPlainObject)(data)) throw new ValidationError(`expected object but got ${data}`, options);
		const result = {};
		for (const key in data) {
			let rKey;
			try {
				rKey = Schema.resolve(key, sKey, options)[0];
			} catch (error) {
				if (strict) continue;
				throw error;
			}
			result[rKey] = property(data, key, inner, options);
			data[rKey] = data[key];
			if (key !== rKey) delete data[key];
		}
		return [result];
	});
	Schema.extend("tuple", (data, { list }, options, strict) => {
		if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
		const result = list.map((inner, index) => property(data, index, inner, options));
		if (strict) return [result];
		result.push(...data.slice(list.length));
		return [result];
	});
	function merge(result, data) {
		for (const key in data) {
			if (key in result) continue;
			result[key] = data[key];
		}
	}
	Schema.extend("object", (data, { dict }, options, strict) => {
		if (!(0, _deepseek_ai_cosmokit.isPlainObject)(data)) throw new ValidationError(`expected object but got ${data}`, options);
		const result = {};
		for (const key in dict) {
			const value = property(data, key, dict[key], options);
			if (!(0, _deepseek_ai_cosmokit.isNullable)(value) || key in data) result[key] = value;
		}
		if (!strict) merge(result, data);
		return [result];
	});
	Schema.extend("union", (data, { list, toString }, options, strict) => {
		const messages = [];
		for (const inner of list) try {
			return Schema.resolve(data, inner, options, strict);
		} catch (error) {
			messages.push(error);
		}
		throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	});
	Schema.extend("intersect", (data, { list, toString }, options, strict) => {
		if (!list.length) return [data];
		let result;
		for (const inner of list) {
			const value = Schema.resolve(data, inner, options, true)[0];
			if ((0, _deepseek_ai_cosmokit.isNullable)(value)) continue;
			if ((0, _deepseek_ai_cosmokit.isNullable)(result)) result = value;
			else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
			else if (typeof value === "object") merge(result ??= {}, value);
			else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		}
		if (!strict && (0, _deepseek_ai_cosmokit.isPlainObject)(data)) merge(result, data);
		return [result];
	});
	Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
		const [result, adapted = data] = Schema.resolve(data, inner, options, true);
		if (preserve) return [callback(result)];
		else return [callback(result), callback(adapted)];
	});
	const formatters = {};
	function defineMethod(name$1, keys, format) {
		formatters[name$1] = format;
		Object.assign(Schema, { [name$1](...args) {
			const schema = new Schema({ type: name$1 });
			keys.forEach((key, index) => {
				switch (key) {
					case "sKey":
						schema.sKey = args[index] ?? Schema.string();
						break;
					case "inner":
						schema.inner = Schema.from(args[index]);
						break;
					case "list":
						schema.list = args[index].map(Schema.from);
						break;
					case "dict":
						schema.dict = (0, _deepseek_ai_cosmokit.valueMap)(args[index], Schema.from);
						break;
					case "bits":
						schema.bits = {};
						for (const key$1 in args[index]) {
							if (typeof args[index][key$1] !== "number") continue;
							schema.bits[key$1] = args[index][key$1];
						}
						break;
					case "callback": {
						const callback = schema.callback = args[index];
						callback["toJSON"] ||= () => callback.toString();
						break;
					}
					case "constructor": {
						const constructor = schema.constructor = args[index];
						if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
						break;
					}
					default: schema[key] = args[index];
				}
			});
			if (name$1 === "object" || name$1 === "dict") schema.meta.default = {};
			else if (name$1 === "array" || name$1 === "tuple") schema.meta.default = [];
			else if (name$1 === "bitset") schema.meta.default = 0;
			return schema;
		} });
	}
	defineMethod("is", ["constructor"], ({ constructor }) => {
		if (typeof constructor === "function") return constructor.name;
		else return constructor;
	});
	defineMethod("any", [], () => "any");
	defineMethod("never", [], () => "never");
	defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
	defineMethod("string", [], () => "string");
	defineMethod("number", [], () => "number");
	defineMethod("boolean", [], () => "boolean");
	defineMethod("bitset", ["bits"], () => "bitset");
	defineMethod("function", [], () => "function");
	defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
	defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
	defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
	defineMethod("object", ["dict"], ({ dict }) => {
		if (Object.keys(dict).length === 0) return "{}";
		return `{ ${Object.entries(dict).map(([key, inner]) => {
			return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
		}).join(", ")} }`;
	});
	defineMethod("union", ["list"], ({ list }, inline) => {
		const result = list.map(({ toString: format }) => format()).join(" | ");
		return inline ? `(${result})` : result;
	});
	defineMethod("intersect", ["list"], ({ list }) => {
		return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
	});
	defineMethod("transform", [
		"inner",
		"callback",
		"preserve"
	], ({ inner }, isInner) => inner.toString(isInner));
	module.exports = Schema;
}));

//#endregion
//#region src/config.ts
var import_lib = /* @__PURE__ */ __toESM(require_lib(), 1);
const z = import_lib.default;
/** 插件配置：用户可在 profile/补丁层覆盖，无需改代码。 */
const Config = z.object({
	userAgent: z.string().default("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36").description("User-Agent"),
	timeoutMs: z.number().default(15e3).description("单次请求超时（毫秒）"),
	proxyUrl: z.string().default("").description("HTTP 代理地址，如 http://127.0.0.1:7890；空 = 直连"),
	maxItems: z.number().default(10).description("列表类工具单次最多返回条数（搜索/相关/热门）"),
	maxReplies: z.number().default(20).description("评论类工具单次最多返回条数"),
	maxDescChars: z.number().default(2e3).description("视频简介最多返回字符数"),
	buvid3Fallback: z.boolean().default(true).description("B 站返回 412 风控页时，带匿名 buvid3 重试一次"),
	sessdata: z.string().role("secret").default("").description("B 站 SESSDATA（Cookie 值），可选。公开搜索/详情/评论匿名即可读取。"),
	asrEnabled: z.boolean().default(true).description("启用音频转写工具 bili_video_transcript（需本地装好 Python + faster-whisper + PyAV）"),
	asrPythonPath: z.string().default("").description("Python 解释器路径；空 = 自动（python/python3/py）"),
	asrModel: z.string().default("base").description("faster-whisper 模型（tiny/base/small/medium/large-v3）"),
	asrLanguage: z.string().default("zh").description("转写语言提示，如 zh / en；空 = 自动检测"),
	asrMaxSeconds: z.number().default(300).description("单次转写最多取多少秒音频（60~1800）"),
	asrTimeoutMs: z.number().default(6e5).description("转写子进程超时（毫秒）")
});

//#endregion
//#region src/http.ts
const BILI_API = "https://api.bilibili.com";
/** 带分类的传输错误：工具层据此给用户可读原因，而不是 `Unexpected token <`。 */
var TransportError = class extends Error {
	kind;
	status;
	constructor(kind, message, status = 0) {
		super(message);
		this.name = "TransportError";
		this.kind = kind;
		this.status = status;
	}
};
/**
* 不能带任何 cookie 的端点白名单（实测结论，见 B站公开接口匿名探测报告）。
*
* `/x/v2/reply/main` 带上 buvid3 后**必定**返回 `replies: []` + `cursor.is_end: true`，
* 也就是「看起来成功了，其实一条评论都没有」。实测矩阵（5 个视频交叉验证）：
*   无 cookie 成功 4/5（各返回 19-20 条）；带 cookie 成功 0/5（全 0 条）。
* 同一视频无 cookie 连打 3 次都稳定返回 20 条，排除了时序偶然。
*
* 这种「失败伪装成成功」最危险 —— 工具层会如实报告「0 条评论」，
* 用户以为视频没评论。所以这里硬编码禁用，而不是靠调用方自觉。
*/
const COOKIELESS_PATHS = ["/x/v2/reply/main", "/x/v2/reply"];
/** 该端点是否必须无 cookie。 */
function mustStayCookieless(path) {
	return COOKIELESS_PATHS.some((p) => path.startsWith(p));
}
/**
* 用变量持有 specifier，避免 TS 在编译期去解析 'undici'、也避免被打包器内联。
*
* undici **不是**本插件的依赖：
* - desktop profile 顶层有 undici（createRequire 实测可解析，ProxyAgent 是 function）；
* - web profile 可能没有（MODULE_NOT_FOUND）；
* - Node 24 也没有 `node:undici` 内置模块。
* 所以只能运行时按需加载：没配 proxyUrl 就永远不碰它，配了但加载不到就给可读错误。
*/
const UNDICI_SPECIFIER = "undici";
async function defaultDispatcherFactory(uri) {
	let mod;
	try {
		mod = await import(UNDICI_SPECIFIER);
	} catch (e) {
		throw new TransportError("network", `配置了 proxyUrl 但当前环境加载不到 undici（${e instanceof Error ? e.message : String(e)}）。请在插件所在 profile 里安装 undici，或清空 proxyUrl 改为直连。`);
	}
	if (typeof mod.ProxyAgent !== "function") throw new TransportError("network", "配置了 proxyUrl 但当前 undici 没有导出 ProxyAgent，请升级 undici 或清空 proxyUrl。");
	return new mod.ProxyAgent({ uri });
}
/** 判别响应是不是 HTML（而不是 JSON）。风控页/404 页都是 HTML。 */
function looksLikeHtml(text, contentType) {
	if (contentType.includes("text/html")) return true;
	const head = text.slice(0, 200).trimStart().toLowerCase();
	return head.startsWith("<!doctype") || head.startsWith("<html");
}
function makeTransport(opts) {
	const fetchImpl = opts.fetchImpl ?? fetch;
	const userAgent = opts.userAgent || "Mozilla/5.0";
	const proxyUrl = (opts.proxyUrl ?? "").trim();
	let dispatcher;
	function getDispatcher() {
		if (!dispatcher) dispatcher = (opts.proxyDispatcherFactory ?? defaultDispatcherFactory)(proxyUrl);
		return dispatcher;
	}
	/** 一次原始请求：返回 { status, contentType, text }。网络异常包装成 TransportError。 */
	async function rawGet(url, cookie) {
		const init = { method: "GET" };
		if (proxyUrl) init.dispatcher = await getDispatcher();
		const headers = {
			"User-Agent": userAgent,
			"Accept": "application/json, text/plain, */*",
			"Referer": "https://www.bilibili.com/"
		};
		if (cookie) headers["Cookie"] = cookie;
		init.headers = headers;
		const ac = new AbortController();
		const timer = setTimeout(() => ac.abort(), opts.timeoutMs);
		init.signal = ac.signal;
		try {
			const res = await fetchImpl(url, init);
			const text = await res.text();
			return {
				status: res.status,
				contentType: res.headers.get("content-type") ?? "",
				text
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			const aborted = ac.signal.aborted;
			throw new TransportError("network", aborted ? `请求超时（${opts.timeoutMs}ms）` : `网络请求失败：${msg}`);
		} finally {
			clearTimeout(timer);
		}
	}
	/** cookie 串：SESSDATA（可选）+ buvid3（回退时）。 */
	function cookieOf(buvid3) {
		const parts = [];
		if (opts.sessdata) parts.push(`SESSDATA=${opts.sessdata}`);
		if (buvid3) parts.push(`buvid3=${buvid3}`);
		return parts.join("; ");
	}
	let buvid3Cache = "";
	let buvid3Tried = false;
	async function ensureBuvid3Inner() {
		if (buvid3Cache) return buvid3Cache;
		if (buvid3Tried) return "";
		buvid3Tried = true;
		try {
			const j = await (await fetchImpl(`${BILI_API}/x/frontend/finger/spi`, {
				method: "GET",
				headers: {
					"User-Agent": userAgent,
					"Referer": "https://www.bilibili.com/"
				}
			})).json();
			if (j.code === 0 && typeof j.data?.b_3 === "string" && j.data.b_3) buvid3Cache = j.data.b_3;
		} catch {}
		return buvid3Cache;
	}
	async function get(path, params) {
		const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
		const url = `${BILI_API}${path}${qs ? `?${qs}` : ""}`;
		const cookieless = mustStayCookieless(path);
		let res = await rawGet(url, cookieless ? "" : cookieOf(""));
		let buvid3TriedForThis = false;
		if (!cookieless && res.status === 412 && opts.buvid3Fallback) {
			const b = await ensureBuvid3Inner();
			if (b) {
				buvid3TriedForThis = true;
				res = await rawGet(url, cookieOf(b));
			}
		}
		if (looksLikeHtml(res.text, res.contentType)) {
			if (res.status === 412) throw new TransportError("risk-control", `触发 B 站安全风控（HTTP 412）。${buvid3TriedForThis ? "已尝试匿名 buvid3 回退仍然 412，说明该出口 IP 被拦得比较彻底：建议配 proxyUrl 换出口 IP，或填 sessdata 换身份。" : "稍后重试，或在插件配置里填 sessdata、或配 proxyUrl 换出口 IP。"}`, 412);
			if (res.status === 404) throw new TransportError("not-found", `接口不存在（HTTP 404）：${path}`, 404);
			throw new TransportError("bad-response", `B 站返回了 HTML 而不是 JSON（HTTP ${res.status}），通常是风控或接口下线。`, res.status);
		}
		let j;
		try {
			j = JSON.parse(res.text);
		} catch {
			throw new TransportError("bad-response", `B 站响应不是 JSON（HTTP ${res.status}，${res.text.length} 字节）`, res.status);
		}
		const o = j;
		const code = typeof o.code === "number" ? o.code : 0;
		if (code !== 0) {
			const message = typeof o.message === "string" ? o.message : "";
			if (code === -404) throw new TransportError("not-found", `B 站接口返回 -404：${message || "资源不存在（视频被删/仅登录可见）"}`, res.status);
			if (code === -400) throw new TransportError("api-error", `B 站接口返回 -400 参数错误：${message}`, res.status);
			if (code === -412 || code === -799) throw new TransportError("risk-control", `B 站接口返回 ${code}（请求被拦截）：${message}`, res.status);
			throw new TransportError("api-error", `B 站接口返回 code=${code}${message ? `：${message}` : ""}`, res.status);
		}
		return o.data;
	}
	return {
		get,
		ensureBuvid3: ensureBuvid3Inner
	};
}
/** 小工具：把 unknown 安全转 string/number（接口字段经常缺失或改型）。 */
function str(v, fallback = "") {
	return typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : fallback;
}
function num(v, fallback = 0) {
	return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function obj(v) {
	return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function arr(v) {
	return Array.isArray(v) ? v : [];
}

//#endregion
//#region src/fragment.ts
/** 结构化数据 -> 可持久化的 JSON 对象（供 presentationMeta 投影，满足 JsonValue 约束）。 */
function toJsonObjects(list) {
	return list;
}
/** 单个对象 -> 可持久化 JSON 对象（detail 这类整体结构用）。 */
function toJsonObject(o) {
	return o;
}
/** 剥掉 B 站搜索接口标题里的 `<em class="keyword">…</em>` 高亮标签，并解实体。 */
function stripEm(s) {
	if (typeof s !== "string") return "";
	return s.replace(/<\/?em[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
}
/** 给 `//i2.hdslb.com/...` 这类协议相对地址补上 `https:`；已是绝对地址则原样返回。 */
function fixPicUrl(u) {
	if (typeof u !== "string" || !u) return "";
	if (u.startsWith("//")) return `https:${u}`;
	if (u.startsWith("http://")) return `https://${u.slice(7)}`;
	return u;
}
/** "21:24" / "1:02:33" -> 秒数；解析不出时返回 0。 */
function durationToSec(d) {
	if (typeof d === "number" && Number.isFinite(d)) return Math.max(0, Math.floor(d));
	if (typeof d !== "string" || !d) return 0;
	const parts = d.split(":");
	if (parts.length < 2 || parts.length > 3) return 0;
	let total = 0;
	for (const p of parts) {
		if (!/^\d+$/.test(p)) return 0;
		total = total * 60 + Number(p);
	}
	return total;
}
/** Unix 秒 -> ISO 串；无效值返回空串（不抛）。 */
function toISO(ts) {
	if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return "";
	const d = /* @__PURE__ */ new Date(ts * 1e3);
	if (Number.isNaN(d.getTime())) return "";
	return d.toISOString();
}
/** Unix 秒 -> 本地可读时间 `YYYY-MM-DD HH:mm`；无效值返回空串。 */
function formatTime(ts) {
	if (!ts || ts <= 0) return "";
	const d = /* @__PURE__ */ new Date(ts * 1e3);
	if (Number.isNaN(d.getTime())) return "";
	const p = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** 播放量等大数 -> 人读串（40584 -> "4.1万"）。 */
function countText(v) {
	if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return "0";
	if (v >= 1e8) return `${(v / 1e8).toFixed(1)}亿`;
	if (v >= 1e4) return `${(v / 1e4).toFixed(1)}万`;
	return String(Math.floor(v));
}
/** 从 BV 号串 / 完整链接里提取 bvid。认 `BV` + 10 位字母数字。 */
function extractBvid(raw) {
	if (!raw) return "";
	const m = /(BV[0-9A-Za-z]{10})/.exec(raw);
	if (m) return m[1];
	return "";
}
function videoUrl(bvid) {
	return `https://www.bilibili.com/video/${bvid}`;
}

//#endregion
//#region src/adapters/bilibili.ts
/**
* B 站适配器：全部匿名可用（实测，见 B站公开接口匿名探测报告）。
*
* ## 端点选择（每一个都是实测比较后的结论，不是照抄文档）
*
* - 搜索   `/x/web-interface/search/all/v2`
*   **不用** `search/type`：实测 `search/type` 纯 UA 下 3/6 次返回 HTTP 412 风控页，
*   而 `all/v2` 同环境 6/6 成功。两者的 video 字段完全一样（bvid/aid/title/author/
*   mid/play/video_review/review/favorites/like/duration/pubdate/typename/tag/pic），
*   `all/v2` 只是多一层 `result[]` 分组（见下方 search() 的注释）。
*   注意 `search/type` 的「偶尔成功」会骗过冒烟测试 —— 绿灯不代表稳定。
*
* - 详情   `/x/web-interface/view/detail`
*   **不用** `view`：`view` 在部分出口 IP 上会被**无差别** -412（实测换个 bvid、
*   换成 aid、带不带 buvid3 全是 412），而 `view/detail` 同 IP 下稳定 200。
*   它一次返回 `{View, Card, Tags, Reply, Related, Spec}`，比 view 还多。
*
* - 评论   `/x/v2/reply/main`，oid **直接传 bvid**
*   实测 oid=aid 与 oid=bvid 返回完全相同的 rpid/点赞/游标（非法 oid 会 code=12002），
*   所以不需要为了拿 aid 先请求一次 view —— 这正是上面 view 被墙时评论仍可用的原因。
*   游标翻页：`cursor.next`，结束标志 `cursor.is_end`。
*
* - UP 主  `card` + `relation/stat`（card 给昵称/头像/签名/等级，relation 给粉丝/关注）
* - 相关   `archive/related`（数组，约 40 条，owner/stat 是嵌套结构）
* - 热门   `popular`（list 数组，同样 owner/stat 嵌套）
*
* ## 字段清洗上的两个坑
* - `title`/`author`/`tag` 带 `<em class="keyword">` 高亮，必须 stripEm；
* - `pic` 是 `//i2.hdslb.com/...` 协议相对地址，必须 fixPicUrl 补 https:；
* - `duration` 在搜索结果里是 `"8:9"` 这种**秒不进位**的字符串，
*   durationToSec 能正确解析成 489 秒，但显示时要按原样或用统一格式，别当 `08:09`。
*/
/** 搜索结果的 duration 既可能是 "8:9"，也可能是秒数。统一成人读串 + 秒数。 */
function normalizeDuration(v) {
	if (typeof v === "number" && Number.isFinite(v)) {
		const sec = Math.max(0, Math.floor(v));
		const h = Math.floor(sec / 3600);
		const m = Math.floor(sec % 3600 / 60);
		const s$1 = sec % 60;
		const p = (n) => String(n).padStart(2, "0");
		return {
			duration: h > 0 ? `${h}:${p(m)}:${p(s$1)}` : `${m}:${p(s$1)}`,
			durationSec: sec
		};
	}
	const s = str(v);
	return {
		duration: s,
		durationSec: durationToSec(s)
	};
}
/** 搜索结果的一条 video 结果 -> VideoItem。 */
function toVideoItem(raw) {
	const o = obj(raw);
	const bvid = extractBvid(str(o.bvid));
	if (!bvid) return void 0;
	const { duration, durationSec } = normalizeDuration(o.duration);
	const pubdate = num(o.pubdate);
	return {
		bvid,
		aid: num(o.aid),
		title: stripEm(o.title),
		author: stripEm(o.author),
		mid: num(o.mid),
		play: num(o.play),
		danmaku: num(o.video_review),
		reply: num(o.review),
		favorite: num(o.favorites),
		like: num(o.like),
		duration,
		durationSec,
		pubdate,
		pubdateISO: toISO(pubdate),
		tname: str(o.typename),
		tag: stripEm(o.tag),
		pic: fixPicUrl(o.pic),
		url: videoUrl(bvid)
	};
}
/**
* view/detail 里的 View 对象 -> VideoItem（用于「相关推荐里排除自己」等场景）。
* related/popular 的条目结构与 search 不同（owner/stat 嵌套），单独走这里。
*/
function nestedToVideoItem(raw) {
	const o = obj(raw);
	const bvid = extractBvid(str(o.bvid));
	if (!bvid) return void 0;
	const stat = obj(o.stat);
	const owner = obj(o.owner);
	const pubdate = num(o.pubdate);
	const { duration, durationSec } = normalizeDuration(o.duration);
	return {
		bvid,
		aid: num(o.aid),
		title: stripEm(o.title),
		author: stripEm(owner.name) || stripEm(o.author),
		mid: num(owner.mid) || num(o.mid),
		play: num(stat.view),
		danmaku: num(stat.danmaku),
		reply: num(stat.reply),
		favorite: num(stat.favorite),
		like: num(stat.like),
		duration,
		durationSec,
		pubdate,
		pubdateISO: toISO(pubdate),
		tname: str(o.tname),
		tag: "",
		pic: fixPicUrl(o.pic),
		url: videoUrl(bvid)
	};
}
/** view/detail 的一条 page -> PageItem。 */
function toPageItem(raw) {
	const o = obj(raw);
	return {
		cid: num(o.cid),
		page: num(o.page),
		part: str(o.part),
		duration: num(o.duration)
	};
}
/** 合集（ugc_season）解析。无合集返回 null。 */
function toSeason(raw) {
	if (!raw || typeof raw !== "object") return null;
	const o = obj(raw);
	const id = num(o.id);
	const title = str(o.title);
	if (!id && !title) return null;
	const sections = [];
	for (const s of arr(o.sections)) {
		const so = obj(s);
		const episodes = [];
		for (const e of arr(so.episodes)) {
			const eo = obj(e);
			const bvid = extractBvid(str(eo.bvid));
			if (!bvid) continue;
			episodes.push({
				title: stripEm(eo.title),
				bvid,
				aid: num(eo.aid)
			});
		}
		sections.push({
			title: str(so.title),
			episodes
		});
	}
	return {
		id,
		title,
		sections
	};
}
/** reply/main 的一条 reply -> ReplyItem。 */
function toReplyItem(raw) {
	const o = obj(raw);
	const rpid = str(o.rpid);
	if (!rpid) return void 0;
	const member = obj(o.member);
	const content = obj(o.content);
	const ctime = num(o.ctime);
	return {
		rpid,
		author: str(member.uname),
		mid: num(member.mid),
		content: str(content.message),
		like: num(o.like),
		rcount: num(o.rcount),
		ctime,
		ctimeISO: toISO(ctime)
	};
}
function makeBilibiliAdapter(tp) {
	return {
		name: "bilibili",
		async search(q, page, limit) {
			const d = obj(await tp.get("/x/web-interface/search/all/v2", {
				keyword: q,
				page: Math.max(1, page)
			}));
			const videoData = arr(obj(arr(d.result).find((g) => str(obj(g).result_type) === "video")).data);
			const items = [];
			for (const v of videoData) {
				const item = toVideoItem(v);
				if (item) items.push(item);
			}
			const numResults = num(d.numResults);
			const numPages = num(d.numPages);
			return {
				items: items.slice(0, Math.max(1, limit)),
				nextPage: page + 1,
				hasMore: numPages > 0 ? page < numPages : videoData.length > 0,
				total: numResults
			};
		},
		async detail(id) {
			const bvid = extractBvid(id);
			const d = obj(obj(await tp.get("/x/web-interface/view/detail", { bvid })).View);
			const stat = obj(d.stat);
			const owner = obj(d.owner);
			const pages = arr(d.pages).map(toPageItem);
			const pubdate = num(d.pubdate);
			return {
				bvid: extractBvid(str(d.bvid)) || bvid,
				aid: num(d.aid),
				cid: num(d.cid) || (pages[0]?.cid ?? 0),
				title: stripEm(d.title),
				desc: str(d.desc),
				pages,
				stat: {
					view: num(stat.view),
					danmaku: num(stat.danmaku),
					reply: num(stat.reply),
					favorite: num(stat.favorite),
					coin: num(stat.coin),
					like: num(stat.like),
					share: num(stat.share)
				},
				owner: {
					mid: num(owner.mid),
					name: str(owner.name),
					face: fixPicUrl(owner.face)
				},
				tname: str(d.tname),
				pubdate,
				pubdateISO: toISO(pubdate),
				durationSec: num(d.duration),
				pic: fixPicUrl(d.pic),
				url: videoUrl(extractBvid(str(d.bvid)) || bvid),
				season: toSeason(d.ugc_season),
				copyright: num(d.copyright)
			};
		},
		async replies(id, page, limit) {
			const bvid = extractBvid(id);
			const d = obj(await tp.get("/x/v2/reply/main", {
				oid: bvid,
				type: 1,
				mode: 3,
				next: Math.max(1, page)
			}));
			const cursor = obj(d.cursor);
			const items = [];
			for (const r of arr(d.replies)) {
				const item = toReplyItem(r);
				if (item) items.push(item);
			}
			const isEnd = cursor.is_end === 1 || cursor.is_end === true;
			return {
				items: items.slice(0, Math.max(1, limit)),
				allCount: num(cursor.all_count),
				hasMore: !isEnd && num(cursor.next) > 0
			};
		},
		async user(id) {
			const mid = Number(String(id).replace(/[^\d]/g, "")) || 0;
			const d = obj(await tp.get("/x/web-interface/card", { mid }));
			const card = obj(d.card);
			const level = num(obj(card.level_info).current_level);
			let fans = num(d.follower);
			let following = 0;
			try {
				const rel = obj(await tp.get("/x/relation/stat", { vmid: mid }));
				fans = num(rel.follower, fans);
				following = num(rel.following);
			} catch {}
			return {
				mid: num(card.mid, mid),
				name: str(card.name),
				face: fixPicUrl(card.face),
				sign: str(card.sign),
				fans,
				following,
				likes: num(card.like_num),
				level
			};
		},
		async related(id, limit) {
			const bvid = extractBvid(id);
			const data = await tp.get("/x/web-interface/archive/related", { bvid });
			const items = [];
			for (const r of arr(data)) {
				const item = nestedToVideoItem(r);
				if (item) items.push(item);
			}
			return {
				items: items.slice(0, Math.max(1, limit)),
				nextPage: 0,
				hasMore: false,
				total: items.length
			};
		},
		async popular(page, limit) {
			const raw = arr(obj(await tp.get("/x/web-interface/popular", {
				ps: Math.max(1, Math.min(50, limit)),
				pn: Math.max(1, page)
			})).list);
			const items = [];
			for (const r of raw) {
				const item = nestedToVideoItem(r);
				if (item) items.push(item);
			}
			const hasMore = raw.length > 0;
			return {
				items: items.slice(0, Math.max(1, limit)),
				nextPage: hasMore ? page + 1 : 0,
				hasMore,
				total: 0
			};
		},
		async audioStreams(bvid, cid) {
			const rawList = arr(obj(obj(await tp.get("/x/player/playurl", {
				bvid,
				cid,
				qn: 64,
				fnval: 16,
				fourk: 1
			})).dash).audio);
			const out = [];
			for (const raw of rawList) {
				const a = obj(raw);
				const baseUrl = str(a.baseUrl) || str(a.base_url);
				if (!baseUrl) continue;
				const backups = arr(a.backupUrl ?? a.backup_url).map((u) => str(u)).filter(Boolean);
				out.push({
					id: num(a.id),
					baseUrl,
					backupUrls: backups,
					bandwidth: num(a.bandwidth),
					mimeType: str(a.mimeType) || str(a.mime_type),
					codecs: str(a.codecs)
				});
			}
			return out;
		}
	};
}

//#endregion
//#region src/asr.ts
/**
* P7：音频提取（sidx 索引切片段）+ 外部 ASR 转写。
*
* ## 为什么要自己解析 sidx，而不是「按比特率估字节数」
*
* 先前的探测脚本（tools/probe_audio.mjs）用的是估算路线：`bandwidth/8 * 秒数` 换算出
* 一个字节数，然后 `Range: bytes=0-<n>` 直接砍。这条路有**三个实测暴露的硬伤**：
*
*   1. **切在音频帧中间**。m4a 的 fragment 边界与字节边界不对齐，砍在中间会丢掉残帧，
*      首尾各有一段解不出来。
*   2. **需要先下载才能知道该下多少**。比特率是 VBR 的（实测同一条流各片段
*      0.590s~0.628s 时长浮动，字节数 28132~30143 浮动），估算必然偏。
*   3. **多取或少取无法自检**。估出来的字节数到底对应多少秒，事前无从验证。
*
* 而 B 站音频流是 **DASH + sidx 索引**的：文件头部的 `sidx` box 直接列出了每个
* fragment 的**字节大小和时长**。读一次 8KB 头部就能拿到完整索引，然后按索引
* 精确取「前 N 秒需要哪几个片段」，一次 Range 请求把它们**连续**取回来。
*
* 实测（BV1GJ411x7h7 / BV1sHa966Eu6 交叉验证）：
*   - 索引表结束偏移**恰好等于** sidx box 的 size 字段（548 == 548）——自校验通过；
*   - 索引覆盖时长 212.39s vs 视频 213s，差值就是一个 fragment；
*   - 按索引取的 60.2s 音频，PyAV 解出 60.16s PCM —— 对齐误差只有 40ms。
*
* ## sidx 的真实二进制布局（踩过的坑，务必按这个来）
*
* 网上文档与我的前几次尝试都在「每个 reference 多少字节」上错了。实测 dump 出
* 字节流后确认，**每一项是 12 字节**（不是规范正文常写的 8 字节或 12 字节变体）：
*
* ```
* 偏移  字段
* +0    box size (4)
* +4    'sidx'   (4)
* +8    version+flags (4)
* +12   reference_ID (4)
* +16   timescale (4)          <- 实测 48000
* +20   earliest_presentation_time  (version==0: 4 字节 / version==1: 8 字节)
* +24   first_offset                (version==0: 4 字节 / version==1: 8 字节)
* +?    reserved (2)
* +?    reference_count (2)
* 之后   reference[] 每项 12 字节：size(4) duration(4) flags(4)
* ```
*
* 关键点：**每项 12 字节、顺序是 size→duration→flags**。
* 曾经按 8 字节项解析，得到 `dur=268435456`（=0x10000000）这种明显荒谬的值，
* 就是因为把 `flags` 的 0x90000000 当成了 duration。判据是「索引表结束偏移
* 必须等于 box size」——这条自校验能立刻戳穿错误的项长。
*
* ## 为什么 ASR 走外部 Python 子进程，而不是纯 JS
*
* 本机实测的可行组合是 `faster-whisper 1.2.1` + `PyAV` + `numpy`，模型
* `Systran/faster-whisper-tiny` 已在 HF 缓存里（**可完全离线**）。但：
*   - faster-whisper 1.2.1 与 PyAV 19 **上游不兼容**（`av.open()` 去掉了
*     `metadata_errors` 参数，而 faster-whisper 还在传），所以**不能把文件直接
*     交给它**，必须自己解码成 PCM 波形数组再 `transcribe(array)`；
*   - Node 侧没有成熟的 whisper 绑定，纯 JS 重写一遍不现实。
*
* 所以架构是：**Node 负责网络与切片段，Python 子进程负责解码 + 转写**，
* 两者用临时文件传 PCM，用 stdout JSON 回传结果。脚本内容内联在
* `ASR_SCRIPT` 常量里（`python -c`），不依赖用户预先放置任何文件。
*
* ## 边界与失败姿态（沿用全插件的硬规则）
*
* - **业务失败一律不抛**：返回 `{ok:false, reason}`，由工具层转成可读文本。
*   典型：Python 不存在、faster-whisper 没装、模型没缓存、音频取不到。
* - **必须如实说明覆盖范围**：返回的 `coveredSeconds` 是**索引实测**的片段总时长，
*   不是用户请求的时长。工具层要把它写进文本，否则模型会把「前 300 秒的文字稿」
*   当成整个视频的内容去总结 —— 那比不给更糟。
*/
/**
* 在 buf 里定位 sidx box 的起始偏移；找不到返回 -1。
*
* 两条都是踩过的坑：
*  1. **偏移不固定**：sidx 之前有 ftyp/moov（moov 大小随音频复杂度变），
*     实测见过 837 与 944，绝不能硬编码偏移。
*  2. **不能按 4 字节对齐扫**：早期实现 `for (i = 4; i += 4)` 假设 box 边界对齐，
*     但实测的 B 站音频流里 `ftyp` 只有 32 字节、`moov` 是 805 字节，
*     于是 sidx 起点落在 837（**奇数偏移**），魔数在 841，4 字节步长永远跳不到，
*     直接漏判成「没有 sidx」。改成逐字节扫描，这点性能开销可以忽略
*     （只在头部 8KB 内扫，且只做一次）。
*
* 另外仍然保留「找到魔数后回退 4 字节」的语义：box 结构是
* `[4 字节 size][4 字节 type]`，所以 type 之前那 4 字节就是 box 起点。
*/
function findSidx(buf) {
	for (let i = 4; i + 4 <= buf.length; i++) if (buf[i] === 115 && buf[i + 1] === 105 && buf[i + 2] === 100 && buf[i + 3] === 120) return i - 4;
	return -1;
}
function u32(buf, at) {
	return (buf[at] << 24 | buf[at + 1] << 16 | buf[at + 2] << 8 | buf[at + 3]) >>> 0;
}
function u16(buf, at) {
	return buf[at] << 8 | buf[at + 1];
}
/**
* 解析 sidx。**`buf` 必须从 sidx box 起点开始**（`buf[4..7]` 是 `'sidx'` 魔数）。
*
* 调用方要先用 `subarray(sidxStart)` 把前面 ftyp/moov 切掉再传进来 ——
* 早期版本把整段头部传进来（`buf[4..7]` 落在 ftyp 里）导致一律报「魔数不匹配」。
*
* 自校验：解析结束后读指针必须**恰好等于** box size —— 这条断言能立刻发现
* 「项长猜错」（例如误按 8 字节项解析时，读指针会与 size 对不上）。
*/
function parseSidx(buf, start = 0) {
	if (buf.length < 32) throw new Error("sidx 太短，无法解析");
	if (!(buf[4] === 115 && buf[5] === 105 && buf[6] === 100 && buf[7] === 120)) throw new Error("sidx 魔数不匹配（期望 'sidx'；调用方要先把头部 subarray 到 box 起点）");
	const size = u32(buf, 0);
	const version = buf[8];
	const timescale = u32(buf, 16);
	if (timescale <= 0) throw new Error(`sidx timescale 非法：${timescale}`);
	let p = 20;
	p += version === 0 ? 4 : 8;
	p += version === 0 ? 4 : 8;
	p += 2;
	const count = u16(buf, p);
	p += 2;
	const fragments = [];
	let offset = 0;
	for (let i = 0; i < count; i++) {
		if (p + 12 > buf.length) throw new Error(`sidx 声明 ${count} 个片段，但数据在第 ${i} 个就截断了`);
		const fragSize = u32(buf, p);
		const duration = u32(buf, p + 4);
		fragments.push({
			size: fragSize,
			duration,
			offset
		});
		offset += fragSize;
		p += 12;
	}
	if (p !== size) throw new Error(`sidx 解析自校验失败：读指针 ${p} != box size ${size}（reference 项长可能猜错了，应为 12 字节）`);
	return {
		timescale,
		fragments,
		size,
		start
	};
}
/** 按索引求出「凑够 seconds 秒」需要取前几个 fragment。返回个数（至少 1，至多全部）。 */
function fragmentsForSeconds(info, seconds) {
	const need = Math.max(0, seconds) * info.timescale;
	let acc = 0;
	for (let i = 0; i < info.fragments.length; i++) {
		acc += info.fragments[i].duration;
		if (acc >= need) return i + 1;
	}
	return info.fragments.length;
}
/** 索引覆盖的总秒数。 */
function sidxSeconds(info) {
	let acc = 0;
	for (const f of info.fragments) acc += f.duration;
	return acc / info.timescale;
}
/** 发一次带 Range 的 GET，返回字节。非 2xx 抛错。 */
async function rangeGet(url, range, opts, fetchImpl) {
	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), Math.max(opts.timeoutMs, 3e4));
	try {
		const res = await fetchImpl(url, {
			method: "GET",
			headers: {
				"User-Agent": opts.userAgent,
				"Referer": "https://www.bilibili.com/",
				"Range": range
			},
			signal: ac.signal
		});
		if (!res.ok && res.status !== 206) throw new Error(`音频请求失败：HTTP ${res.status}`);
		return new Uint8Array(await res.arrayBuffer());
	} finally {
		clearTimeout(timer);
	}
}
/**
* 取一段音频：先读头部拿 sidx，再按索引把需要的 fragment 连续取回。
*
* `stream` 由调用方从 playurl 结果里挑好传入（本模块不碰 B 站 JSON 接口，
* 保持「网络策略在适配器层、音频解析在本层」的边界）。
*/
async function fetchAudioSlice(stream, opts) {
	const fetchImpl = opts.fetchImpl ?? fetch;
	const headBytes = opts.headBytes ?? 8192;
	const seconds = Math.max(1, Math.min(opts.maxSeconds, Math.floor(opts.seconds)));
	const conn = {
		userAgent: opts.userAgent,
		timeoutMs: opts.timeoutMs
	};
	let head;
	try {
		head = await rangeGet(stream.baseUrl, `bytes=0-${headBytes - 1}`, conn, fetchImpl);
	} catch (e) {
		return {
			ok: false,
			reason: `读取音频头部失败：${e instanceof Error ? e.message : String(e)}`
		};
	}
	const sidxStart = findSidx(head);
	if (sidxStart < 0) return {
		ok: false,
		reason: "音频流里没有找到 sidx 索引（可能换成了非 DASH 格式），无法按时长精确切片段"
	};
	let info;
	try {
		let buf = head.subarray(sidxStart);
		const declared = u32(head, sidxStart);
		if (declared > buf.length) buf = await rangeGet(stream.baseUrl, `bytes=${sidxStart}-${sidxStart + declared - 1}`, conn, fetchImpl);
		info = parseSidx(buf, sidxStart);
	} catch (e) {
		return {
			ok: false,
			reason: `解析 sidx 失败：${e instanceof Error ? e.message : String(e)}`
		};
	}
	if (info.fragments.length === 0) return {
		ok: false,
		reason: "sidx 索引里没有任何音频片段（视频可能没有音频轨）"
	};
	const dataStart = info.start + info.size;
	const count = fragmentsForSeconds(info, seconds);
	const picked = info.fragments.slice(0, count);
	const coveredSamples = picked.reduce((a, f) => a + f.duration, 0);
	let bytes;
	try {
		const init = await rangeGet(stream.baseUrl, `bytes=0-${dataStart - 1}`, conn, fetchImpl);
		const totalPicked = picked.reduce((a, f) => a + f.size, 0);
		const firstOff = picked[0].offset;
		const body = await rangeGet(stream.baseUrl, `bytes=${dataStart + firstOff}-${dataStart + firstOff + totalPicked - 1}`, conn, fetchImpl);
		bytes = new Uint8Array(init.length + body.length);
		bytes.set(init, 0);
		bytes.set(body, init.length);
	} catch (e) {
		return {
			ok: false,
			reason: `下载音频片段失败：${e instanceof Error ? e.message : String(e)}`
		};
	}
	return {
		ok: true,
		slice: {
			bytes,
			coveredSeconds: coveredSamples / info.timescale,
			fragmentCount: picked.length,
			totalFragments: info.fragments.length,
			stream,
			streamSeconds: sidxSeconds(info)
		}
	};
}
/**
* 交给 `python -c` 的脚本：从 stdin 读 **m4a 字节** -> PyAV 解码成 PCM -> faster-whisper -> stdout JSON。
*
* 四个刻意的设计：
*  1. **解码放在 Python 侧**，因为 Node 没有解 m4a 的能力：传过去的是容器字节而不是 PCM。
*  2. **自己用 PyAV 解码，不把文件交给 faster-whisper**（上游 `metadata_errors` 不兼容，
*     见文件头注释）。用 `av.open(io.BytesIO(...))` 直接从内存读，不落磁盘。
*  3. **逐包容错**：片段首尾切在音频帧中间时，会有极少数包解码失败。实测 347 个包里
*     恰好 1 个失败（首包），直接跳过即可，不要整体失败。
*  4. **stdout 只输出一行 JSON**：任何库的警告都走 stderr，避免污染解析。
*/
const ASR_SCRIPT = String.raw`
import sys, json, io, traceback
def main():
    raw = sys.stdin.buffer.read()
    try:
        import av, numpy as np
        from faster_whisper import WhisperModel
        if len(raw) == 0:
            print(json.dumps({"ok": False, "reason": "空音频"})); return

        TARGET_SR = 16000
        container = av.open(io.BytesIO(raw), mode="r")
        stream = None
        for s in container.streams:
            if s.type == "audio":
                stream = s; break
        if stream is None:
            print(json.dumps({"ok": False, "reason": "m4a 里没有音频流"})); return
        cc = stream.codec_context
        cc.open()
        resampler = av.AudioResampler(format="s16", layout="mono", rate=TARGET_SR)
        chunks = []
        failed = 0
        for pkt in container.demux(stream):
            if pkt.dts is None:
                continue
            try:
                frames = cc.decode(pkt)
            except Exception:
                failed += 1          # 切在帧中间的残包，跳过即可
                continue
            for f in frames:
                for rf in resampler.resample(f):
                    chunks.append(rf.to_ndarray())
        for rf in resampler.resample(None):
            chunks.append(rf.to_ndarray())
        container.close()
        if not chunks:
            print(json.dumps({"ok": False, "reason": "解码得到 0 个样本（片段可能不含音频数据）"})); return
        pcm = np.concatenate(chunks, axis=1).reshape(-1).astype(np.float32) / 32768.0

        model_name = __MODEL__
        try:
            model = WhisperModel(model_name, device="cpu", compute_type="int8")
        except Exception as e:
            print(json.dumps({"ok": False, "reason": "模型加载失败(可能未缓存 %s): %s" % (model_name, e)}, ensure_ascii=False)); return
        lang = __LANG__
        segs, info = model.transcribe(pcm, language=lang, beam_size=1, vad_filter=False)
        out = []
        for s in segs:
            out.append({"start": round(float(s.start), 2), "end": round(float(s.end), 2), "text": s.text.strip()})
        text = "".join(s["text"] for s in out)
        print(json.dumps({
            "ok": True,
            "language": info.language,
            "languageProbability": round(float(info.language_probability), 3),
            "duration": round(float(info.duration), 2),
            "decodedSeconds": round(len(pcm) / TARGET_SR, 2),
            "failedPackets": failed,
            "segments": out,
            "text": text,
        }, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "reason": "%s: %s" % (type(e).__name__, e), "trace": traceback.format_exc()[-800:]}, ensure_ascii=False))

main()
`;
/**
* 转写一段 **m4a 字节**（解码在 Python 侧完成，见 ASR_SCRIPT 注释）。
* 失败返回 {ok:false}，**不抛**（沿用全插件「业务失败不抛」的规则）。
*/
async function transcribeAudio(audio, opts) {
	if (audio.length === 0) return {
		ok: false,
		reason: "没有可转写的音频数据"
	};
	const script = ASR_SCRIPT.replace("__MODEL__", JSON.stringify(opts.model)).replace("__LANG__", opts.language ? JSON.stringify(opts.language) : "None");
	return await new Promise((resolve) => {
		const child = spawn(opts.pythonPath, ["-c", script], {
			stdio: [
				"pipe",
				"pipe",
				"pipe"
			],
			windowsHide: true
		});
		const chunks = [];
		const errChunks = [];
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			child.kill();
			resolve({
				ok: false,
				reason: `转写超时（${opts.timeoutMs}ms），可减小 maxSeconds 或换更小的模型`
			});
		}, opts.timeoutMs);
		const done = (r) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(r);
		};
		child.stdout.on("data", (d) => chunks.push(d));
		child.stderr.on("data", (d) => errChunks.push(d));
		child.on("error", (e) => {
			done({
				ok: false,
				reason: `启动 ${opts.pythonPath} 失败：${e.message}（可用 asrPythonPath 指定解释器路径）`
			});
		});
		child.on("close", (code) => {
			const stdout = Buffer.concat(chunks).toString("utf8").trim();
			const stderr = Buffer.concat(errChunks).toString("utf8").trim();
			const line = stdout.split(/\r?\n/).filter(Boolean).pop() ?? "";
			if (!line) {
				done({
					ok: false,
					reason: `ASR 子进程没有输出（退出码 ${code}）${stderr ? `：${stderr.slice(-300)}` : ""}`
				});
				return;
			}
			try {
				const j = JSON.parse(line);
				if (j.ok === true) done({
					ok: true,
					language: typeof j.language === "string" ? j.language : "",
					languageProbability: typeof j.languageProbability === "number" ? j.languageProbability : 0,
					duration: typeof j.duration === "number" ? j.duration : 0,
					decodedSeconds: typeof j.decodedSeconds === "number" ? j.decodedSeconds : 0,
					failedPackets: typeof j.failedPackets === "number" ? j.failedPackets : 0,
					segments: Array.isArray(j.segments) ? j.segments : [],
					text: typeof j.text === "string" ? j.text : ""
				});
				else done({
					ok: false,
					reason: typeof j.reason === "string" ? j.reason : "ASR 失败（未给出原因）"
				});
			} catch {
				done({
					ok: false,
					reason: `无法解析 ASR 输出：${line.slice(0, 200)}`
				});
			}
		});
		child.stdin.on("error", () => {});
		child.stdin.end(Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength));
	});
}
/**
* 探测 Python 环境里 ASR 依赖是否齐备（不加载模型，很快）。
* 工具层用它给出「装了什么/缺什么」的可读提示，而不是等转写时才失败。
*/
async function probeAsrEnvironment(pythonPath, timeoutMs = 2e4) {
	const script = String.raw`
import json
mods = {}
for name in ['av', 'faster_whisper', 'numpy']:
    try:
        __import__(name); mods[name] = True
    except Exception as e:
        mods[name] = False
print(json.dumps(mods))
`;
	return await new Promise((resolve) => {
		const child = spawn(pythonPath, ["-c", script], {
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			],
			windowsHide: true
		});
		const chunks = [];
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			child.kill();
			resolve({
				python: false,
				av: false,
				fasterWhisper: false,
				numpy: false,
				detail: `Python 探测超时（${timeoutMs}ms）`
			});
		}, timeoutMs);
		const finish = (r) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(r);
		};
		child.stdout.on("data", (d) => chunks.push(d));
		child.on("error", (e) => finish({
			python: false,
			av: false,
			fasterWhisper: false,
			numpy: false,
			detail: `找不到 Python 解释器「${pythonPath}」：${e.message}`
		}));
		child.on("close", (code) => {
			const out = Buffer.concat(chunks).toString("utf8").trim();
			const line = out.split(/\r?\n/).filter(Boolean).pop() ?? "";
			try {
				const j = JSON.parse(line);
				const missing = [
					"av",
					"faster_whisper",
					"numpy"
				].filter((m) => j[m] !== true);
				finish({
					python: true,
					av: j.av === true,
					fasterWhisper: j.faster_whisper === true,
					numpy: j.numpy === true,
					detail: missing.length === 0 ? "Python 环境就绪（av / faster_whisper / numpy 均可用）" : `缺少 Python 包：${missing.join("、")}（用 pip install ${missing.join(" ").replace(/_/g, "-")} 安装）`
				});
			} catch {
				finish({
					python: false,
					av: false,
					fasterWhisper: false,
					numpy: false,
					detail: `Python 探测失败（退出码 ${code}）：${(line || out).slice(0, 200)}`
				});
			}
		});
	});
}

//#endregion
//#region src/tool.ts
/**
* 工具层：6 个默认工具（bili_video_search / bili_video_detail / bili_video_replies /
* bili_video_related / bili_user_profile / bili_popular）+ 1 个可选工具
* `bili_video_transcript`（`asrEnabled` 默认 true，本机 ASR 环境实测可用；
* 没装环境时它会返回可读说明而不报错）。
*
* 本插件只做 B 站。其他平台（抖音/快手/小红书等）的内容检索不在范围里：
* 抖音搜索撞登录墙（status_code 2483）、详情 403 网关墙，唯一可用的热榜价值有限；
* 与其提供一个半残能力，不如明确不提供。
*
* 两条贯穿全文件的硬规则（沿用贴吧插件已验证的规则）：
* 1. **业务失败一律返回 `{text, items:[]}`，绝不 throw** —— throw 只留给参数错误。
* 2. OUTPUT_SCHEMA 是 `additionalProperties:false`，execute 只能返回 `{text, items}`；
*    所有额外字段（标题、总数、hasMore…）一律走 presentationMeta。
*/
const OUTPUT_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		text: {
			type: "string",
			required: true
		},
		items: {
			type: "array",
			required: true,
			items: {
				type: "object",
				additionalProperties: true
			}
		}
	}
};
function ok(text, items) {
	return {
		text,
		items: toJsonObjects(items)
	};
}
function fail(text) {
	return {
		text,
		items: []
	};
}
/**
* 搜索排序：**故意不暴露给模型**。
*
* 接口确实接受 `order`（totalrank/click/pubdate/dm/stow），但实测它**不能作为排序控制使用**：
* 同一关键词下六个取值的**前三位 bvid 完全相同**（综合排序是主导的），只有更靠后的位置
* 才出现差异，而且差异方向不可信 —— 传 `order=click` 时第 5 位出现的是播放 165 的视频，
* 而不传参时第 5 位是播放 126163 的视频。也就是说它既不是「播放量降序」，也不是稳定的
* 另一种排序，把它暴露出去会让模型以为自己能按播放量取结果，反而误导用户。
*
* 所以搜索固定走默认综合排序（不传 order）。原始实测见 DEVELOPMENT.md 与探测报告。
*/
/** 把任意异常转成给用户看的一句话（TransportError 已经带了可读原因）。 */
function reason(e) {
	return e instanceof Error ? e.message : String(e);
}
/** 提取条数上限。 */
function clamp(n, lo, hi, dflt) {
	const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : dflt;
	return Math.max(lo, Math.min(hi, v));
}
function mediaTools(config) {
	const bili = makeBilibiliAdapter(makeTransport({
		userAgent: config.userAgent,
		timeoutMs: config.timeoutMs,
		proxyUrl: config.proxyUrl || void 0,
		sessdata: config.sessdata || void 0,
		buvid3Fallback: config.buvid3Fallback
	}));
	/**
	* 一行视频摘要，三个列表工具共用同一格式。
	* 故意只保留「标题 / UP主 / 时长 / 日期 / 链接」：播放量、弹幕、评论、点赞、
	* 投币、收藏这些明细数据对用户是噪声（用户 m02609 明确说「完全没必要展示」），
	* 需要热度时让模型自己再调一次详情。url 必须渲染出来：否则模型只能报标题，
	* 用户点不回原页面，而模型一旦「补」链接就会编出重复/错误的 BV（实测踩过这个坑）。
	*/
	const videoLine = (i, v) => `${i + 1}. ${v.title} · ${v.author || "未知UP"} · ${v.duration || "未知时长"}${v.pubdateISO ? ` · ${v.pubdateISO.slice(0, 10)}` : ""}${v.url ? `\n   ${v.url}` : ""}`;
	const videoSearch = defineTool({
		name: "bili_video_search",
		description: "按关键词搜索 B 站视频（返回 bvid/标题/UP主/播放/弹幕/评论/收藏/点赞/时长/发布时间/分区/标签/封面/链接）。当用户说「B 站上搜/找某个视频」「某话题在 B 站有什么内容」时使用。按B站综合排序返回，支持 page 翻页（每页 20 条）。注意：单次默认只返回 10 条——结果过长会被宿主从中截断，中间的视频链接会一起丢失；需要更多结果请翻页（page=2/3…），不要一次要满 20 条。",
		parameters: {
			keyword: {
				type: "string",
				required: true,
				description: "搜索关键词，如「鸣潮 心月狐」"
			},
			page: {
				type: "number",
				description: "页码，从 1 开始，默认 1；每页 20 条"
			},
			limit: {
				type: "number",
				description: `本页最多返回条数，默认 ${config.maxItems}`
			}
		},
		output: {
			schema: OUTPUT_SCHEMA,
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}],
			presentationMeta: (args, value) => {
				const first = value.items[0];
				return {
					kind: "bili-search",
					keyword: typeof args.keyword === "string" ? args.keyword : "",
					page: typeof first?.page === "number" ? first.page : 1,
					hasMore: first?.hasMore === true,
					total: typeof first?.total === "number" ? first.total : 0,
					items: value.items
				};
			}
		},
		isConcurrencySafe: () => true,
		async execute(args) {
			const keyword = typeof args.keyword === "string" ? args.keyword.trim() : "";
			if (!keyword) throw new Error("bili_video_search: keyword 是必填参数");
			const page = clamp(args.page, 1, 50, 1);
			const limit = clamp(args.limit, 1, 50, config.maxItems);
			try {
				const r = await bili.search(keyword, page, limit);
				if (r.items.length === 0) return fail(`B 站没有搜到与「${keyword}」相关的视频（第 ${page} 页；换个更短的关键词试试）`);
				const lines = r.items.map((v, i) => videoLine(i, v));
				const nav = r.hasMore ? `还有下一页：继续调用本工具并传 page=${page + 1}` : `已经是最后一页（第 ${page} 页）`;
				const total = r.total > 0 ? `（共约 ${countText(r.total)} 条结果）` : "";
				return ok([
					`B 站搜索「${keyword}」第 ${page} 页，返回 ${r.items.length} 条${total}：`,
					...lines,
					nav
				].join("\n"), r.items.map((v) => ({
					...v,
					page,
					hasMore: r.hasMore,
					total: r.total
				})));
			} catch (e) {
				return fail(`B 站搜索「${keyword}」失败：${reason(e)}`);
			}
		},
		presentCall: () => ({
			card: "generic",
			title: "B 站搜索",
			kind: "other"
		}),
		presentResult(_args, result) {
			if (result.isError) return void 0;
			const meta = result.meta;
			return {
				card: "generic",
				title: `B 站搜索 · ${Array.isArray(meta?.items) ? meta.items.length : 0} 条`,
				kind: "other"
			};
		}
	});
	const videoDetail = defineTool({
		name: "bili_video_detail",
		description: "读取一个 B 站视频的详情：标题、简介、分 P 列表、合集结构、UP 主、互动数据、分区、发布时间。当用户给了 BV 号或 bilibili.com/video/BV... 链接、或要「总结某个视频讲了什么」时使用（第一步就调它）。注意：CC 字幕匿名拿不到（接口的 subtitles 恒为空），本插件不提供字幕。",
		parameters: { bvid: {
			type: "string",
			required: true,
			description: "BV 号，或 https://www.bilibili.com/video/BV... 完整链接"
		} },
		output: {
			schema: OUTPUT_SCHEMA,
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}],
			presentationMeta: (args, value) => {
				const first = value.items[0];
				return {
					kind: "bili-detail",
					bvid: typeof first?.bvid === "string" ? first.bvid : typeof args.bvid === "string" ? extractBvid(args.bvid) : "",
					detail: first ?? {}
				};
			}
		},
		isConcurrencySafe: () => true,
		async execute(args) {
			const bvid = extractBvid(typeof args.bvid === "string" ? args.bvid.trim() : "");
			if (!bvid) throw new Error("bili_video_detail: bvid 是必填参数（BV 号或含 BV... 的链接）");
			try {
				const d = await bili.detail(bvid);
				if (!d.title) return fail(`视频 ${bvid} 没有取到详情（可能已被删除、仅登录可见，或 BV 号有误）`);
				const desc = d.desc.length > config.maxDescChars ? `${d.desc.slice(0, config.maxDescChars)}…（简介已截断，原文 ${d.desc.length} 字）` : d.desc;
				const lines = [
					`标题：${d.title}`,
					`UP 主：${d.owner.name}（mid ${d.owner.mid}） · 分区：${d.tname || "未知"}`,
					`时长 ${Math.floor(d.durationSec / 60)}分${d.durationSec % 60}秒 · 发布 ${formatTime(d.pubdate)} · ${d.copyright === 1 ? "自制" : d.copyright === 2 ? "转载" : "版权未知"}`,
					`链接：${d.url}`
				];
				if (d.pages.length > 1) {
					lines.push(`分 P（共 ${d.pages.length} 个）：`);
					for (const p of d.pages.slice(0, 30)) lines.push(`  P${p.page} ${p.part}（${Math.floor(p.duration / 60)}分${p.duration % 60}秒）`);
				}
				if (d.season) {
					lines.push(`合集《${d.season.title}》：`);
					for (const s of d.season.sections) {
						lines.push(`  ${s.title}（${s.episodes.length} 集）`);
						for (const ep of s.episodes.slice(0, 20)) lines.push(`    ${ep.title}`);
					}
				}
				if (desc) lines.push(`简介：${desc}`);
				return ok(lines.join("\n"), [{
					...toJsonObject(d),
					bvid: d.bvid
				}]);
			} catch (e) {
				return fail(`读取视频 ${bvid} 详情失败：${reason(e)}`);
			}
		},
		presentCall: () => ({
			card: "generic",
			title: "B 站视频详情",
			kind: "other"
		}),
		presentResult(_args, result) {
			if (result.isError) return void 0;
			const meta = result.meta;
			return {
				card: "generic",
				title: meta?.detail?.title ? `视频 · ${meta.detail.title}` : "B 站视频详情",
				kind: "other"
			};
		}
	});
	const videoReplies = defineTool({
		name: "bili_video_replies",
		description: "读取一个 B 站视频的评论（昵称/内容/点赞/楼中楼数/总评论数）。当用户想了解观众反馈、要看「评论区在说什么」、或要配合详情总结一个视频时使用。注意：评论数可能上万，本工具按热度排序抽样返回前 N 条，不要把全部评论塞进上下文；可用 page 翻页。",
		parameters: {
			bvid: {
				type: "string",
				required: true,
				description: "BV 号，或含 BV... 的完整链接"
			},
			page: {
				type: "number",
				description: "翻页游标页码，从 1 开始，默认 1；每页约 20 条"
			},
			limit: {
				type: "number",
				description: `本页最多返回条数，默认 ${config.maxReplies}`
			}
		},
		output: {
			schema: OUTPUT_SCHEMA,
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}],
			presentationMeta: (args, value) => {
				const first = value.items[0];
				return {
					kind: "bili-replies",
					bvid: typeof args.bvid === "string" ? extractBvid(args.bvid) : "",
					aid: typeof first?.aid === "number" ? first.aid : 0,
					page: typeof first?.page === "number" ? first.page : 1,
					hasMore: first?.hasMore === true,
					allCount: typeof first?.allCount === "number" ? first.allCount : 0,
					items: value.items
				};
			}
		},
		isConcurrencySafe: () => true,
		async execute(args) {
			const bvid = extractBvid(typeof args.bvid === "string" ? args.bvid.trim() : "");
			if (!bvid) throw new Error("bili_video_replies: bvid 是必填参数（BV 号或含 BV... 的链接）");
			const page = clamp(args.page, 1, 100, 1);
			const limit = clamp(args.limit, 1, 50, config.maxReplies);
			try {
				const r = await bili.replies(bvid, page, limit);
				if (r.items.length === 0) return fail(`视频 ${bvid} 第 ${page} 页没有取到评论（可能已翻到底、评论已关闭，或视频被删）`);
				const lines = r.items.map((c, i) => `${i + 1}. ${c.author}（赞 ${countText(c.like)}${c.rcount ? ` · 楼中楼 ${c.rcount}` : ""}）：${c.content.slice(0, 200)}`);
				const count = r.allCount > r.items.length ? `（全视频共约 ${countText(r.allCount)} 条，本页取前 ${r.items.length} 条）` : `（共 ${r.items.length} 条）`;
				const nav = r.hasMore ? `还有下一页：继续调用本工具并传 page=${page + 1}` : `已经是最后一页`;
				return ok([
					`视频 ${bvid} 的评论${count}：`,
					...lines,
					nav
				].join("\n"), r.items.map((c) => ({
					...c,
					aid: 0,
					page,
					hasMore: r.hasMore,
					allCount: r.allCount
				})));
			} catch (e) {
				return fail(`读取视频 ${bvid} 评论失败：${reason(e)}`);
			}
		},
		presentCall: () => ({
			card: "generic",
			title: "B 站评论",
			kind: "other"
		}),
		presentResult(_args, result) {
			if (result.isError) return void 0;
			const meta = result.meta;
			return {
				card: "generic",
				title: `B 站评论 · ${Array.isArray(meta?.items) ? meta.items.length : 0} 条`,
				kind: "other"
			};
		}
	});
	const videoRelated = defineTool({
		name: "bili_video_related",
		description: "读取一个 B 站视频的相关推荐视频（同搜索结果的字段）。当用户看完一个视频想找同类内容、或想知道「这个 UP/这个题材还有什么」时使用。注意：默认只返回 10 条，结果过长会被宿主从中截断导致中间链接丢失；需要更多请自行翻页或分次查询。",
		parameters: {
			bvid: {
				type: "string",
				required: true,
				description: "BV 号，或含 BV... 的完整链接"
			},
			limit: {
				type: "number",
				description: `最多返回条数，默认 ${config.maxItems}（接口约给 40 条）`
			}
		},
		output: {
			schema: OUTPUT_SCHEMA,
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}],
			presentationMeta: (args, value) => ({
				kind: "bili-related",
				bvid: typeof args.bvid === "string" ? extractBvid(args.bvid) : "",
				items: value.items
			})
		},
		isConcurrencySafe: () => true,
		async execute(args) {
			const bvid = extractBvid(typeof args.bvid === "string" ? args.bvid.trim() : "");
			if (!bvid) throw new Error("bili_video_related: bvid 是必填参数（BV 号或含 BV... 的链接）");
			const limit = clamp(args.limit, 1, 50, config.maxItems);
			try {
				if (!bili.related) return fail("当前适配器不支持相关推荐");
				const r = await bili.related(bvid, limit);
				if (r.items.length === 0) return fail(`视频 ${bvid} 没有取到相关推荐（可能视频被删或接口变动）`);
				const lines = r.items.map((v, i) => videoLine(i, v));
				return ok([`视频 ${bvid} 的相关推荐，返回 ${r.items.length} 条：`, ...lines].join("\n"), r.items);
			} catch (e) {
				return fail(`读取视频 ${bvid} 相关推荐失败：${reason(e)}`);
			}
		},
		presentCall: () => ({
			card: "generic",
			title: "B 站相关推荐",
			kind: "other"
		}),
		presentResult(_args, result) {
			if (result.isError) return void 0;
			const meta = result.meta;
			return {
				card: "generic",
				title: `相关推荐 · ${Array.isArray(meta?.items) ? meta.items.length : 0} 条`,
				kind: "other"
			};
		}
	});
	const userProfile = defineTool({
		name: "bili_user_profile",
		description: "读取一个 B 站 UP 主的资料（昵称/粉丝/关注/获赞/等级/签名/头像）。当用户问某个 UP 主是谁、有多少粉丝、或要判断一个视频作者的分量时使用。",
		parameters: { mid: {
			type: "string",
			required: true,
			description: "UP 主的 mid（数字 id），或 space.bilibili.com/<mid> 链接"
		} },
		output: {
			schema: OUTPUT_SCHEMA,
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}],
			presentationMeta: (args, value) => {
				const first = value.items[0];
				return {
					kind: "bili-user",
					mid: typeof first?.mid === "number" ? first.mid : Number(String(args.mid ?? "").replace(/[^\d]/g, "")) || 0,
					items: value.items
				};
			}
		},
		isConcurrencySafe: () => true,
		async execute(args) {
			const mid = (typeof args.mid === "string" ? args.mid.trim() : "").replace(/[^\d]/g, "");
			if (!mid) throw new Error("bili_user_profile: mid 是必填参数（数字 id 或 space.bilibili.com/<mid> 链接）");
			try {
				const u = await bili.user(mid);
				if (!u.name) return fail(`UP 主 ${mid} 没有取到资料（mid 是否正确？账号可能已注销）`);
				return ok([
					`UP 主：${u.name}（mid ${u.mid}）`,
					`粉丝 ${countText(u.fans)} · 等级 Lv${u.level}`,
					u.sign ? `签名：${u.sign}` : "",
					`主页：https://space.bilibili.com/${u.mid}`
				].filter(Boolean).join("\n"), [u]);
			} catch (e) {
				return fail(`读取 UP 主 ${mid} 资料失败：${reason(e)}`);
			}
		},
		presentCall: () => ({
			card: "generic",
			title: "B 站 UP 主",
			kind: "other"
		}),
		presentResult(_args, result) {
			if (result.isError) return void 0;
			const meta = result.meta;
			const name$1 = Array.isArray(meta?.items) ? meta.items[0]?.name : void 0;
			return {
				card: "generic",
				title: name$1 ? `UP 主 · ${name$1}` : "B 站 UP 主",
				kind: "other"
			};
		}
	});
	const popular = defineTool({
		name: "bili_popular",
		description: "读取 B 站当前热门视频榜。当用户说「B 站上现在什么火」「今天有什么热门视频」时使用。注意：只提供全站榜（多分区榜单需要用分区 id，与站点体系不一致，实测不可靠）。默认只返回 10 条，避免结果过长被宿主截断导致中间链接丢失。",
		parameters: {
			page: {
				type: "number",
				description: "页码，从 1 开始，默认 1"
			},
			limit: {
				type: "number",
				description: `本页最多返回条数，默认 ${config.maxItems}`
			}
		},
		output: {
			schema: OUTPUT_SCHEMA,
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}],
			presentationMeta: (args, value) => ({
				kind: "bili-popular",
				page: typeof args.page === "number" ? Math.floor(args.page) : 1,
				hasMore: value.items.length > 0,
				items: value.items
			})
		},
		isConcurrencySafe: () => true,
		async execute(args) {
			const page = clamp(args.page, 1, 20, 1);
			const limit = clamp(args.limit, 1, 50, config.maxItems);
			try {
				if (!bili.popular) return fail("当前适配器不支持热门榜");
				const r = await bili.popular(page, limit);
				if (r.items.length === 0) return fail(`B 站热门榜第 ${page} 页没有取到内容（可能已翻到底或接口变动）`);
				const lines = r.items.map((v, i) => videoLine(i, v));
				return ok([`B 站热门视频榜 第 ${page} 页，返回 ${r.items.length} 条（当前快照，不是完整趋势）：`, ...lines].join("\n"), r.items);
			} catch (e) {
				return fail(`读取 B 站热门榜第 ${page} 页失败：${reason(e)}`);
			}
		},
		presentCall: () => ({
			card: "generic",
			title: "B 站热门",
			kind: "other"
		}),
		presentResult(_args, result) {
			if (result.isError) return void 0;
			const meta = result.meta;
			return {
				card: "generic",
				title: `B 站热门 · ${Array.isArray(meta?.items) ? meta.items.length : 0} 条`,
				kind: "other"
			};
		}
	});
	/** 依次试几个常见 Python 解释器名，返回第一个能用的。 */
	async function resolvePython(configured) {
		if (configured.trim()) return configured.trim();
		for (const cand of [
			"python",
			"python3",
			"py"
		]) if ((await probeAsrEnvironment(cand, 8e3)).python) return cand;
		return "python";
	}
	/** 按带宽挑一条音频流。**挑最低码率**：转写只在乎可懂度，拿最小流最快。 */
	function pickStream(streams) {
		if (streams.length === 0) return void 0;
		return [...streams].sort((a, b) => (a.bandwidth || 0) - (b.bandwidth || 0))[0];
	}
	/** 把秒数说成人话。 */
	const secText = (s) => {
		const t = Math.max(0, Math.round(s));
		return t >= 60 ? `${Math.floor(t / 60)} 分 ${t % 60} 秒` : `${t} 秒`;
	};
	const videoTranscript = defineTool({
		name: "bili_video_transcript",
		description: "把一个 B 站视频的**音频转写成文字稿**（取前若干秒，默认 300 秒）。当用户要「这个视频讲了什么」、而简介/分P/评论不足以回答、必须听内容时使用。注意三点：(1) B 站 CC 字幕匿名拿不到，本工具是下载音频后做本地语音识别，不是读字幕；(2) 默认只覆盖视频开头若干秒，返回文本会写明覆盖范围，**不要把片段内容当成整个视频的内容**；(3) 需要本地装好 Python + faster-whisper，未开启时本工具会说明如何启用，而不是报错。",
		parameters: {
			bvid: {
				type: "string",
				required: true,
				description: "BV 号，或含 BV... 的完整链接"
			},
			maxSeconds: {
				type: "number",
				description: `从视频开头取多少秒来转写，默认 ${config.asrMaxSeconds}（上限 1800）`
			},
			page: {
				type: "number",
				description: "分 P 序号，从 1 开始，默认 1"
			}
		},
		output: {
			schema: OUTPUT_SCHEMA,
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}],
			presentationMeta: (args, value) => {
				const first = value.items[0];
				return {
					kind: "bili-transcript",
					bvid: typeof first?.bvid === "string" ? first.bvid : typeof args.bvid === "string" ? extractBvid(args.bvid) : "",
					title: typeof first?.title === "string" ? first.title : "",
					coveredSeconds: typeof first?.coveredSeconds === "number" ? first.coveredSeconds : 0,
					videoSeconds: typeof first?.videoSeconds === "number" ? first.videoSeconds : 0,
					language: typeof first?.language === "string" ? first.language : "",
					truncated: first?.truncated === true,
					items: value.items
				};
			}
		},
		isConcurrencySafe: () => false,
		async execute(args) {
			const bvid = extractBvid(typeof args.bvid === "string" ? args.bvid.trim() : "");
			if (!bvid) throw new Error("bili_video_transcript: bvid 是必填参数（BV 号或含 BV... 的链接）");
			const page = clamp(args.page, 1, 999, 1);
			const wantSeconds = clamp(args.maxSeconds, 10, 1800, config.asrMaxSeconds);
			if (!config.asrEnabled) return fail("音频转写未启用（当前 asrEnabled=false）。\n本插件不自带 ASR 引擎，需要本地环境：\n  1. 装 Python 3.9+\n  2. pip install faster-whisper av\n  3. 在插件配置里设 asrEnabled=true\n在此之前，可以用 bili_video_detail 拿简介/分P/合集结构，配合 bili_video_replies 看评论，多数「这视频讲什么」的问题已能回答。");
			let cid = 0;
			let title = "";
			let videoSeconds = 0;
			try {
				const d = await bili.detail(bvid);
				title = d.title;
				videoSeconds = d.durationSec;
				const p = d.pages.find((x) => x.page === page) ?? d.pages[0];
				cid = p?.cid ?? 0;
				if (!cid) return fail(`视频 ${bvid} 没有取到 cid（分 P ${page} 是否存在？）`);
				if (p && p.page !== page) return fail(`视频 ${bvid} 没有第 ${page} 个分 P（共 ${d.pages.length} 个）`);
			} catch (e) {
				return fail(`读取视频 ${bvid} 信息失败：${reason(e)}`);
			}
			const pythonPath = await resolvePython(config.asrPythonPath);
			const env = await probeAsrEnvironment(pythonPath);
			if (!env.python) return fail(`音频转写不可用：${env.detail}\n（可用 asrPythonPath 指定解释器路径，例如 C:\\Python312\\python.exe）`);
			if (!env.av || !env.fasterWhisper) return fail(`音频转写环境不完整：${env.detail}`);
			if (!bili.audioStreams) return fail("当前适配器不支持音频流");
			let streams;
			try {
				streams = await bili.audioStreams(bvid, cid);
			} catch (e) {
				return fail(`取视频 ${bvid} 的音频流失败：${reason(e)}`);
			}
			const stream = pickStream(streams);
			if (!stream) return fail(`视频 ${bvid} 没有可用的音频流（可能是无声视频）`);
			const fetched = await fetchAudioSlice(stream, {
				seconds: wantSeconds,
				maxSeconds: 1800,
				userAgent: config.userAgent,
				timeoutMs: config.timeoutMs
			});
			if (!fetched.ok) return fail(`取视频 ${bvid} 的音频片段失败：${fetched.reason}`);
			const slice = fetched.slice;
			const asr = await transcribeAudio(slice.bytes, {
				pythonPath,
				model: config.asrModel,
				language: config.asrLanguage,
				timeoutMs: config.asrTimeoutMs
			});
			if (!asr.ok) return fail(`视频 ${bvid} 音频转写失败：${asr.reason}`);
			const covered = Math.round(slice.coveredSeconds);
			const wholeVideo = videoSeconds > 0 && covered >= videoSeconds - 2;
			const head = [
				`视频：${title || bvid}（${bvid}，分 P ${page}）`,
				wholeVideo ? `覆盖范围：整个视频（约 ${secText(videoSeconds)}）` : `覆盖范围：**仅前 ${secText(covered)}**` + (videoSeconds > 0 ? `（视频全长 ${secText(videoSeconds)}）` : "") + "，以下是这段音频的转写",
				`识别语言：${asr.language || "未知"}（置信度 ${(asr.languageProbability * 100).toFixed(0)}%） · 模型 ${config.asrModel} · 音频 ${slice.fragmentCount}/${slice.totalFragments} 个片段`
			];
			const body = asr.text.trim() ? asr.text.trim() : "（这段音频没有识别出文字：可能是纯音乐、无人声，或片段不含有效语音）";
			return ok([
				...head,
				"",
				body,
				"",
				wholeVideo ? "说明：以上覆盖了整个视频。" : `说明：以上**只是视频前 ${secText(covered)} 的内容**，不要把它当作整个视频的总结。需要更多时可调大 maxSeconds（上限 1800 秒）重试。`
			].join("\n"), [{
				bvid,
				title,
				page,
				cid,
				coveredSeconds: covered,
				videoSeconds,
				language: asr.language,
				languageProbability: asr.languageProbability,
				truncated: !wholeVideo,
				segments: toJsonObjects(asr.segments),
				text: asr.text
			}]);
		},
		presentCall: () => ({
			card: "generic",
			title: "B 站音频转写",
			kind: "other"
		}),
		presentResult(_args, result) {
			if (result.isError) return void 0;
			const meta = result.meta;
			return {
				card: "generic",
				title: `音频转写${meta?.title ? ` · ${meta.title}` : ""}${typeof meta?.coveredSeconds === "number" ? ` · ${Math.round(meta.coveredSeconds)}s` : ""}`,
				kind: "other"
			};
		}
	});
	const tools = [
		videoSearch,
		videoDetail,
		videoReplies,
		videoRelated,
		userProfile,
		popular
	];
	if (config.asrEnabled) tools.push(videoTranscript);
	return tools;
}

//#endregion
//#region src/skill.ts
/**
* 技能提供者：注册 `media-briefing` 技能，规范模型拿到工具数据后的播报格式。
*
* 为什么要单独做一个技能而不是只靠系统提示：系统提示讲「什么时候用哪个工具」，
* 技能讲「拿到数据后怎么组织回复」——后者只在真正播报时才需要，分开可省上下文。
*/
const PROVIDER_NAME = "dsh-media-search";
const CANDIDATES = [{
	name: "media-briefing",
	description: "播报 B 站媒体数据时使用：规定搜索结果、视频详情、评论、热门榜的汇报格式（每条一行带链接、数字带量级、只依据工具数据不编造、说明抽样与翻页边界）。",
	invocation: {
		modelInvocable: true,
		userInvocable: true
	},
	provider: PROVIDER_NAME,
	source: "bundled",
	rank: BUNDLED_SKILL_RANK,
	locator: "media-briefing"
}];
const BODY = `# 媒体播报规范（media-briefing）

调用媒体工具（bili_video_search / bili_video_detail / bili_video_replies /
bili_video_related / bili_user_profile / bili_popular / bili_video_transcript）拿到数据后，
按本规范组织回复。

## 结构契约（按顺序）
1. **先报定位**：一句话说清「在哪个平台、搜了什么/看的哪个视频」，以及拿到多少条。
2. **列表逐条一行**：每条 = \`[标题](链接) · UP主 · 发布时间\`。
   封面(pic)、标签等只在用户明确要看时补上，不要每条都堆。
3. **视频详情**：先给结论（这个视频讲什么），再给关键数据（标题/UP主/分区/时长/发布时间/链接）；
   分 P 与合集用嵌套列表，超过 20 项时说明「仅列前 20 项」。
4. **评论**：按点赞从高到低摘录，每条标作者与点赞数；评论上万条时**必须**说明
   「按热度只取前 N 条，未读全部」。
5. **结尾一句**：需要下一页/更多时，提示可继续翻 page 或用相关推荐工具。

## 数据粒度（用户嫌过详，默认都别铺）
- **默认只给**：标题、链接、UP 主、发布时间、视频/UP 主的定位性数字（粉丝数、时长）。
- **播放量、弹幕数、评论数、点赞、投币、收藏这类明细数据默认不展示** ——
  它们是噪声，用户要的是「这是什么、在哪看、哪天发的」。只在用户明确问
  「数据怎么样 / 有多少播放 / 热度如何」时才逐项给出。
- 同理，简介/标签/封面图默认省略，用户要看再补。

## 必含要素
- 视频链接必须给（用户要能点回原页面），且**只能是工具返回体里那一个**
  （搜索/相关/热门结果现在每行末尾自带 \`https://www.bilibili.com/video/<bvid>\`）。
- 数据条数要说清（例：「共约 1000 条结果，本页 10 条」），不要让用户猜。
- 数字带量级（「1072.5万」而不是「107248125」），工具返回里已格式化好，直接沿用；
  但按上面的粒度规则，这类数字默认根本不出现。

## 格式契约
- 中文回复；列表用 markdown 列表；一条内容一行，不写成长段落。
- 先结论后证据；引用哪条就给哪条的链接。

## 边界（不做什么）
- **只依据工具返回的数据**，不编造标题、UP 主、播放量、评论或热度。
- **不编造字幕/视频内容**：本插件拿不到 CC 字幕，需要概括内容时只能依据标题、简介、
  评论与分 P 信息，并如实说明依据来源。
- **不编造链接**：链接只能用工具返回体里的那一个。工具没给链接时，宁可只报标题，
  也不要「补」一个 BV 号 —— 编出来的链接会指向别的视频（实测踩过：20 条结果全成了同一个 BV）。
- **不越界到其他平台**：本插件只覆盖 B 站。用户问其他平台时，直接说没有这些能力，
  不要拿 B 站的结果冒充。
- 工具返回空/失败时，直接说失败原因（关键词无结果 / 视频被删 / 412 风控 / 需要登录），
  不要用训练记忆填空。
- 工具已经做了抽样与截断，超过上限的内容必须说明「只取到前 N 条，其余未读」。
- 不要整段复制简介或评论原文（版权），摘录关键句即可。
`;
const mediaSkillProvider = {
	name: PROVIDER_NAME,
	list: () => Promise.resolve(CANDIDATES),
	async get(candidate) {
		return {
			name: candidate.name,
			description: candidate.description,
			invocation: candidate.invocation,
			provider: PROVIDER_NAME,
			source: "bundled",
			content: BODY
		};
	}
};

//#endregion
//#region src/index.ts
const name = "dsh-media-search";
const inject = [
	"tools",
	"skills",
	"systemPrompt"
];
/** B 站工具的使用边界，写进系统提示（段落名与贴吧插件的 tool:tieba 并列）。 */
const PROMPT = `## Query media (bilibili)
用户询问 B 站内容时，使用媒体搜索工具族（读公开数据，匿名即可，不需要登录）：
- \`bili_video_search\`：按关键词搜 B 站视频，按 B 站综合排序返回（插件不提供排序参数，
  因为 B 站的 order 参数实测不能可靠控制排序，不要向用户承诺「按播放量排序」）；
  支持 page 翻页，每页 20 条。返回的每一条都带可点击链接，**照原样给用户**，
  不要自己改写或「补」BV 号 —— 编出来的链接会指向错误视频。
- \`bili_video_detail\`：一个视频的标题/简介/分 P/合集/UP 主/互动数据。用户给 BV 号或
  bilibili.com/video/BV... 链接时**第一步就调它**。CC 字幕匿名拿不到，本插件不提供字幕。
- \`bili_video_replies\`：视频评论（按热度抽样，可 page 翻页；上万条评论不要全读进来）。
- \`bili_video_related\`：视频的相关推荐。
- \`bili_user_profile\`：UP 主资料（粉丝/关注/获赞/等级/签名）。
- \`bili_popular\`：B 站当前热门榜。
- \`bili_video_transcript\`（仅在 asrEnabled=true 时注册）：把一个 B 站视频的音频转写成文字稿。
  当用户问「这个视频讲了什么」而简介/分P/评论答不上来时用它，而不是只甩一个链接。
  它只覆盖视频**开头若干秒**（默认 300，上限 1800），返回体会写明覆盖范围 ——
  必须把这句话一起转达，不要把片段内容说成整个视频的总结。
 工具失败时会返回一段可读说明（例如「B 站返回 412 风控」），把说明转达给用户即可，
 不要对同一个失败调用重试超过 1 次。

本插件**只覆盖 B 站**。用户问到其他平台时，如实说明本插件没有这些能力，
不要拿 B 站的结果冒充，也不要凭训练记忆编造其他平台的内容。

**播报粒度**：默认只给「标题 + 链接 + UP 主 + 发布时间」。播放量、弹幕、评论、点赞、
投币、收藏这类明细数据**默认不要逐个罗列** —— 用户明确问热度/数据时才给。`;
/**
* 兜底：即使 cordis 没走到 schema（例如宿主行为变化、或有人直接调 apply），
* 也不能让 config 是 undefined —— 否则读 config.userAgent 会抛进 ctx.effect 里，
* 被 cordis 静默吞掉，表现为「工具全没了但没有任何报错」。
*/
function normalizeConfig(config) {
	const result = Config["~standard"].validate(config ?? {});
	if ("issues" in result) throw new Error(`dsh-media-search 配置无效：${JSON.stringify(result.issues)}`);
	return result.value;
}
function apply(ctx, rawConfig) {
	const config = normalizeConfig(rawConfig);
	ctx.effect(() => {
		const disposers = mediaTools(config).map((tool) => ctx.tools.register(tool));
		return () => disposers.forEach((d) => d());
	}, "dsh-media-search.tools");
	ctx.effect(() => ctx.skills.registerProvider(() => mediaSkillProvider), "dsh-media-search.skill");
	ctx.effect(() => ctx.systemPrompt.section({
		name: "tool:mediasearch",
		order: 118,
		text: PROMPT
	}), "dsh-media-search.prompt");
}

//#endregion
export { Config, apply, inject, name };