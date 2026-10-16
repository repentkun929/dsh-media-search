window.__ModuleLoader__.load({ id: "dsh-media-search", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
let react_jsx_runtime = require("react/jsx-runtime");

//#region src/fragment.ts
/** 每种 kind 承载列表的字段名。Toolview 校验时必须按这张表取，
*  否则会出现「某个 kind 永远校验失败、卡片静默退化成纯文本」的 bug。 */
const META_LIST_FIELD = {
	"bili-search": "items",
	"bili-detail": "pages",
	"bili-replies": "items",
	"bili-related": "items",
	"bili-user": "items",
	"bili-popular": "items",
	"bili-transcript": "items"
};
/** 从持久化 meta 还原结构化数据（浏览器端 Toolview 入口）。
*  校验规则跟随 META_LIST_FIELD：每个 kind 只认自己那张表里声明的数组字段。
*  注意 bili-detail 的列表字段是 `pages`，且它挂在 `detail` 子对象上 ——
*  这里对 detail 做单独判定，不套用通用的顶层数组检查。 */
function mediaMetaFrom(meta) {
	if (!meta || typeof meta !== "object") return void 0;
	const m = meta;
	const kind = m.kind;
	if (typeof kind !== "string" || !kind.startsWith("bili-")) return void 0;
	if (kind === "bili-detail") {
		const d = m.detail;
		if (!d || typeof d !== "object") return void 0;
		if (!Array.isArray(d.pages)) return void 0;
		return m;
	}
	const field = META_LIST_FIELD[kind];
	if (field === void 0) return void 0;
	if (!Array.isArray(m[field])) return void 0;
	return m;
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

//#endregion
//#region src/client/toolview.tsx
const rowStyle = {
	padding: "6px 0",
	borderTop: "1px solid rgba(128,128,128,.2)"
};
const headStyle = {
	fontWeight: 600,
	marginBottom: 8
};
const subtle = {
	opacity: .62,
	fontSize: 12
};
function Loading() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		style: {
			padding: 12,
			fontSize: 13,
			color: "var(--text-secondary, #888)"
		},
		children: "⏳ 正在读取媒体数据…"
	});
}
function Fallback({ block }) {
	const c = block.content;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		style: {
			padding: 12,
			fontSize: 13,
			whiteSpace: "pre-wrap"
		},
		children: (Array.isArray(c) && c.length > 0 && typeof c[0] === "object" && c[0] !== null && "text" in c[0] ? String(c[0].text) : "") || "媒体结果不可用"
	});
}
/**
* 一行视频。列表类视图共用（VideoItem 已在 fragment.ts 定好型）。
* 副行只留 UP / 分区 / 时长 / 日期 —— 播放量、弹幕这类明细对用户是噪声
* （与服务端 videoLine 的口径一致，见 src/tool.ts）。
*/
function VideoRow({ v }) {
	const title = v.title || "(无标题)";
	const url = v.url || void 0;
	const pub = v.pubdateISO ? v.pubdateISO.slice(0, 10) : "";
	const line = [
		v.author ? `UP ${v.author}` : "",
		v.tname,
		v.duration,
		pub
	].filter(Boolean).join(" · ");
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: rowStyle,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: url ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
			href: url,
			target: "_blank",
			rel: "noreferrer",
			children: title
		}) : title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			style: subtle,
			children: line
		})]
	});
}
function SearchView({ meta }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			padding: 12,
			fontSize: 13
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: headStyle,
				children: [
					"B 站搜索「",
					meta.keyword,
					"」· 第 ",
					meta.page,
					" 页 · ",
					meta.items.length,
					" 条",
					meta.total > 0 ? `（共约 ${countText(meta.total)} 条）` : ""
				]
			}),
			meta.items.map((v, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VideoRow, { v }, v.bvid || String(i))),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					marginTop: 8,
					...subtle
				},
				children: meta.hasMore ? `还有第 ${meta.page + 1} 页可读` : "已到最后一页"
			})
		]
	});
}
function RelatedView({ meta }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			padding: 12,
			fontSize: 13
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			style: headStyle,
			children: [
				meta.bvid,
				" 的相关推荐 · ",
				meta.items.length,
				" 条"
			]
		}), meta.items.map((v, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VideoRow, { v }, v.bvid || String(i)))]
	});
}
function PopularView({ meta }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			padding: 12,
			fontSize: 13
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: headStyle,
				children: [
					"B 站热门榜 · 第 ",
					meta.page,
					" 页 · ",
					meta.items.length,
					" 条"
				]
			}),
			meta.items.map((v, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VideoRow, { v }, v.bvid || String(i))),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					marginTop: 8,
					...subtle
				},
				children: meta.hasMore ? `还有第 ${meta.page + 1} 页可读` : "已到最后一页"
			})
		]
	});
}
function RepliesView({ meta }) {
	const total = meta.allCount > meta.items.length ? ` · 全视频共约 ${countText(meta.allCount)} 条，本页取 ${meta.items.length} 条` : "";
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			padding: 12,
			fontSize: 13
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: headStyle,
				children: [
					meta.bvid,
					" 的评论 · 第 ",
					meta.page,
					" 页",
					total
				]
			}),
			meta.items.map((c, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: rowStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: c.author || "匿名" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: subtle,
					children: [
						" ",
						"赞 ",
						countText(c.like),
						c.rcount ? ` · 楼中楼 ${c.rcount}` : "",
						c.ctimeISO ? ` · ${formatTime(c.ctime)}` : ""
					]
				})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: c.content.length > 300 ? `${c.content.slice(0, 300)}…` : c.content })]
			}, c.rpid || `r${i}`)),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					marginTop: 8,
					...subtle
				},
				children: meta.hasMore ? `还有第 ${meta.page + 1} 页可读` : "已到最后一页"
			})
		]
	});
}
function UserView({ meta }) {
	const u = meta.items[0];
	if (!u) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		style: {
			padding: 12,
			fontSize: 13
		},
		children: "没有取到 UP 主资料"
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			padding: 12,
			fontSize: 13
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: headStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
					href: `https://space.bilibili.com/${u.mid}`,
					target: "_blank",
					rel: "noreferrer",
					children: u.name
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: subtle,
					children: [
						"（mid ",
						u.mid,
						"）"
					]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: subtle,
				children: [
					"粉丝 ",
					countText(u.fans),
					" · Lv",
					u.level
				]
			}),
			u.sign ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					marginTop: 4,
					opacity: .85
				},
				children: u.sign
			}) : null
		]
	});
}
function DetailView({ meta }) {
	const d = meta.detail;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			padding: 12,
			fontSize: 13
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: headStyle,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
					href: d.url,
					target: "_blank",
					rel: "noreferrer",
					children: d.title
				})
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: subtle,
				children: [
					"UP ",
					d.owner.name,
					" · ",
					d.tname || "未知分区",
					d.pubdateISO ? ` · ${d.pubdateISO.slice(0, 10)}` : ""
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: { marginTop: 4 },
				children: [
					"时长 ",
					Math.floor(d.durationSec / 60),
					"分",
					d.durationSec % 60,
					"秒",
					d.pages.length > 1 ? ` · ${d.pages.length} 个分 P` : ""
				]
			}),
			d.pages.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: { marginTop: 6 },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("b", { children: [
						"分 P（",
						d.pages.length,
						"）"
					] }),
					d.pages.slice(0, 30).map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: subtle,
						children: [
							"P",
							p.page,
							" ",
							p.part
						]
					}, p.cid)),
					d.pages.length > 30 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: subtle,
						children: "…仅列前 30 个分 P"
					}) : null
				]
			}) : null,
			d.season ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: { marginTop: 6 },
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("b", { children: [
					"合集《",
					d.season.title,
					"》"
				] }), d.season.sections.map((s) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: subtle,
					children: [
						s.title,
						"（",
						s.episodes.length,
						" 集）"
					]
				}, s.title))]
			}) : null,
			d.desc ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					marginTop: 6,
					opacity: .8,
					maxHeight: 160,
					overflow: "auto",
					whiteSpace: "pre-wrap"
				},
				children: d.desc.length > 800 ? `${d.desc.slice(0, 800)}…` : d.desc
			}) : null
		]
	});
}
/**
* 音频转写卡。
*
* 这个卡片的**首要职责不是展示文字，而是把「只覆盖了前 N 秒」说清楚** ——
* 服务端已经在文本里声明过，但如果卡片只渲染文字稿、不显示覆盖范围，
* 用户截一张图就很容易把它当成整个视频的内容。所以覆盖范围用醒目样式放在最上面。
*/
function TranscriptView({ meta }) {
	const t = meta.items[0];
	if (!t) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		style: {
			padding: 12,
			fontSize: 13
		},
		children: "没有取到转写结果"
	});
	const covered = Math.max(0, Math.round(t.coveredSeconds));
	const total = Math.max(0, Math.round(t.videoSeconds));
	const tip = t.truncated ? `⚠ 只转写了前 ${covered} 秒` + (total > 0 ? `（视频全长 ${total} 秒）` : "") + "，不代表整个视频的内容" : `已覆盖整个视频（约 ${covered} 秒）`;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			padding: 12,
			fontSize: 13
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: headStyle,
				children: t.title ? `${t.title}（${t.bvid}）` : t.bvid
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					...subtle,
					color: t.truncated ? "var(--text-warning, #b8860b)" : void 0,
					marginBottom: 6
				},
				children: tip
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: subtle,
				children: [
					"识别语言 ",
					t.language || "未知",
					t.languageProbability > 0 ? `（置信度 ${Math.round(t.languageProbability * 100)}%）` : "",
					t.segments.length > 0 ? ` · ${t.segments.length} 个分段` : ""
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					marginTop: 6,
					maxHeight: 320,
					overflow: "auto",
					whiteSpace: "pre-wrap",
					lineHeight: 1.7
				},
				children: t.text || "（没有识别出文字）"
			})
		]
	});
}
function MediaView({ block }) {
	if (!("kind" in block)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, {});
	if (block.isError) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fallback, { block });
	const meta = mediaMetaFrom(block.meta);
	if (!meta) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fallback, { block });
	if (meta.kind === "bili-search") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchView, { meta });
	if (meta.kind === "bili-detail") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DetailView, { meta });
	if (meta.kind === "bili-replies") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RepliesView, { meta });
	if (meta.kind === "bili-related") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RelatedView, { meta });
	if (meta.kind === "bili-user") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UserView, { meta });
	if (meta.kind === "bili-popular") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PopularView, { meta });
	if (meta.kind === "bili-transcript") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TranscriptView, { meta });
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fallback, { block });
}

//#endregion
//#region src/client/index.tsx
const name = "dsh-media-search";
const inject = ["slots"];
const TOOL_KEYS = [
	"bili_video_search",
	"bili_video_detail",
	"bili_video_replies",
	"bili_video_related",
	"bili_user_profile",
	"bili_popular",
	"bili_video_transcript"
];
function apply(ctx) {
	for (const key of TOOL_KEYS) ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
		name: "tool.call.toolview",
		key
	}, MediaView));
}

//#endregion
exports.apply = apply;
exports.inject = inject;
exports.name = name;
return module.exports; } });