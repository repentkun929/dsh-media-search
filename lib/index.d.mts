import { Context } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";

//#region src/config.d.ts
/** 插件配置：用户可在 profile/补丁层覆盖，无需改代码。 */
declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
  /** UA：B 站多数 web 接口对 UA 不敏感，但带真 UA 更稳（412 风控率更低）。 */
  userAgent: Schema<string, string, "defined">;
  /** 单次请求超时。 */
  timeoutMs: Schema<number, number, "defined">;
  /** 可选 HTTP 代理（打不开 api.bilibili.com 时用）。空 = 直连。 */
  proxyUrl: Schema<string, string, "defined">;
  /**
   * 列表类工具单次上限。
   * 默认 10 而不是 20：harness 的 spill-policy 把超过 ~12500 token 的工具结果
   * 从中间截断（只留头尾 + 一句「完整结果在 X 文件」），20 条搜索文本刚好压线，
   * 中间若干条的 url 会连着一起被砍掉（实测踩过：模型只看到前 N 条带链接）。
   * 10 条以内能稳定整条带回模型；要更多就翻页，别指望单页吃满。
   */
  maxItems: Schema<number, number, "defined">;
  /** 评论单次上限（防止上万条评论灌爆上下文）。 */
  maxReplies: Schema<number, number, "defined">;
  /** 简介截断长度。 */
  maxDescChars: Schema<number, number, "defined">;
  /**
   * 风控回退：B 站 412 时是否带匿名 buvid3 cookie 重试一次。
   * 实测带 buvid3 能显著降低 412 概率；关掉则 412 直接结构化失败。
   */
  buvid3Fallback: Schema<boolean, boolean, "defined">;
  /**
   * 可选登录态：Cookie 里的 SESSDATA 值。
   * B 站搜索/详情/评论**匿名即可读**，无需登录；填了主要能扩大可见范围。
   * 注意：CC 字幕即使登录也未必拿得到（本插件不提供字幕工具，见 README）。
   */
  sessdata: Schema<string, string, "defined">;
  /**
   * 总开关。默认 **true**：实测本机 Python + av + faster_whisper + numpy 可用，
   * 端到端 90 秒音频 8.1 秒转写完成（base 模型）。未装环境时工具不报错，
   * 会返回「如何启用」的可读说明，所以默认打开不会让环境缺失的人看到报错。
   * 关掉的理由：转写要起 Python 子进程、下载音频，属于重操作。
   */
  asrEnabled: Schema<boolean, boolean, "defined">;
  /** Python 解释器。留空时依次试 python / python3 / py。 */
  asrPythonPath: Schema<string, string, "defined">;
  /** whisper 模型。tiny 最快但中文准确率一般，small 更准但更慢。 */
  asrModel: Schema<string, string, "defined">;
  /** 语言提示；留空 = 自动检测。中文视频建议填 zh，能省掉检测开销也更稳。 */
  asrLanguage: Schema<string, string, "defined">;
  /** 单次转写音频时长上限（秒）。方案给的区间是 60~1800。 */
  asrMaxSeconds: Schema<number, number, "defined">;
  /** 转写超时。长音频 + 小模型很慢，默认给足。 */
  asrTimeoutMs: Schema<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
  /** UA：B 站多数 web 接口对 UA 不敏感，但带真 UA 更稳（412 风控率更低）。 */
  userAgent: Schema<string, string, "defined">;
  /** 单次请求超时。 */
  timeoutMs: Schema<number, number, "defined">;
  /** 可选 HTTP 代理（打不开 api.bilibili.com 时用）。空 = 直连。 */
  proxyUrl: Schema<string, string, "defined">;
  /**
   * 列表类工具单次上限。
   * 默认 10 而不是 20：harness 的 spill-policy 把超过 ~12500 token 的工具结果
   * 从中间截断（只留头尾 + 一句「完整结果在 X 文件」），20 条搜索文本刚好压线，
   * 中间若干条的 url 会连着一起被砍掉（实测踩过：模型只看到前 N 条带链接）。
   * 10 条以内能稳定整条带回模型；要更多就翻页，别指望单页吃满。
   */
  maxItems: Schema<number, number, "defined">;
  /** 评论单次上限（防止上万条评论灌爆上下文）。 */
  maxReplies: Schema<number, number, "defined">;
  /** 简介截断长度。 */
  maxDescChars: Schema<number, number, "defined">;
  /**
   * 风控回退：B 站 412 时是否带匿名 buvid3 cookie 重试一次。
   * 实测带 buvid3 能显著降低 412 概率；关掉则 412 直接结构化失败。
   */
  buvid3Fallback: Schema<boolean, boolean, "defined">;
  /**
   * 可选登录态：Cookie 里的 SESSDATA 值。
   * B 站搜索/详情/评论**匿名即可读**，无需登录；填了主要能扩大可见范围。
   * 注意：CC 字幕即使登录也未必拿得到（本插件不提供字幕工具，见 README）。
   */
  sessdata: Schema<string, string, "defined">;
  /**
   * 总开关。默认 **true**：实测本机 Python + av + faster_whisper + numpy 可用，
   * 端到端 90 秒音频 8.1 秒转写完成（base 模型）。未装环境时工具不报错，
   * 会返回「如何启用」的可读说明，所以默认打开不会让环境缺失的人看到报错。
   * 关掉的理由：转写要起 Python 子进程、下载音频，属于重操作。
   */
  asrEnabled: Schema<boolean, boolean, "defined">;
  /** Python 解释器。留空时依次试 python / python3 / py。 */
  asrPythonPath: Schema<string, string, "defined">;
  /** whisper 模型。tiny 最快但中文准确率一般，small 更准但更慢。 */
  asrModel: Schema<string, string, "defined">;
  /** 语言提示；留空 = 自动检测。中文视频建议填 zh，能省掉检测开销也更稳。 */
  asrLanguage: Schema<string, string, "defined">;
  /** 单次转写音频时长上限（秒）。方案给的区间是 60~1800。 */
  asrMaxSeconds: Schema<number, number, "defined">;
  /** 转写超时。长音频 + 小模型很慢，默认给足。 */
  asrTimeoutMs: Schema<number, number, "defined">;
}>>, "plain">;
type Config = ReturnType<typeof Config>;
//#endregion
//#region src/index.d.ts
declare const name = "dsh-media-search";
declare const inject: string[];
declare function apply(ctx: Context, rawConfig: Config): void;
//#endregion
export { Config, apply, inject, name };