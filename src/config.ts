import Schema from '@deepseek-ai/schemastery'

const z = Schema

/** 插件配置：用户可在 profile/补丁层覆盖，无需改代码。 */
export const Config = z.object({
  /** UA：B 站多数 web 接口对 UA 不敏感，但带真 UA 更稳（412 风控率更低）。 */
  userAgent: z.string().default(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  ).description('User-Agent'),
  /** 单次请求超时。 */
  timeoutMs: z.number().default(15000).description('单次请求超时（毫秒）'),
  /** 可选 HTTP 代理（打不开 api.bilibili.com 时用）。空 = 直连。 */
  proxyUrl: z.string().default('').description('HTTP 代理地址，如 http://127.0.0.1:7890；空 = 直连'),
  /**
   * 列表类工具单次上限。
   * 默认 10 而不是 20：harness 的 spill-policy 把超过 ~12500 token 的工具结果
   * 从中间截断（只留头尾 + 一句「完整结果在 X 文件」），20 条搜索文本刚好压线，
   * 中间若干条的 url 会连着一起被砍掉（实测踩过：模型只看到前 N 条带链接）。
   * 10 条以内能稳定整条带回模型；要更多就翻页，别指望单页吃满。
   */
  maxItems: z.number().default(10).description('列表类工具单次最多返回条数（搜索/相关/热门）'),
  /** 评论单次上限（防止上万条评论灌爆上下文）。 */
  maxReplies: z.number().default(20).description('评论类工具单次最多返回条数'),
  /** 简介截断长度。 */
  maxDescChars: z.number().default(2000).description('视频简介最多返回字符数'),
  /**
   * 风控回退：B 站 412 时是否带匿名 buvid3 cookie 重试一次。
   * 实测带 buvid3 能显著降低 412 概率；关掉则 412 直接结构化失败。
   */
  buvid3Fallback: z.boolean().default(true).description('B 站返回 412 风控页时，带匿名 buvid3 重试一次'),
  /**
   * 可选登录态：Cookie 里的 SESSDATA 值。
   * B 站搜索/详情/评论**匿名即可读**，无需登录；填了主要能扩大可见范围。
   * 注意：CC 字幕即使登录也未必拿得到（本插件不提供字幕工具，见 README）。
   */
  sessdata: z.string().role('secret').default('').description(
    'B 站 SESSDATA（Cookie 值），可选。公开搜索/详情/评论匿名即可读取。'),

  /* ---------------- P7：音频转写（bili_video_transcript） ---------------- */

  /**
   * 总开关。默认 **true**：实测本机 Python + av + faster_whisper + numpy 可用，
   * 端到端 90 秒音频 8.1 秒转写完成（base 模型）。未装环境时工具不报错，
   * 会返回「如何启用」的可读说明，所以默认打开不会让环境缺失的人看到报错。
   * 关掉的理由：转写要起 Python 子进程、下载音频，属于重操作。
   */
  asrEnabled: z.boolean().default(true).description(
    '启用音频转写工具 bili_video_transcript（需本地装好 Python + faster-whisper + PyAV）'),
  /** Python 解释器。留空时依次试 python / python3 / py。 */
  asrPythonPath: z.string().default('').description('Python 解释器路径；空 = 自动（python/python3/py）'),
  /** whisper 模型。tiny 最快但中文准确率一般，small 更准但更慢。 */
  asrModel: z.string().default('base').description('faster-whisper 模型（tiny/base/small/medium/large-v3）'),
  /** 语言提示；留空 = 自动检测。中文视频建议填 zh，能省掉检测开销也更稳。 */
  asrLanguage: z.string().default('zh').description('转写语言提示，如 zh / en；空 = 自动检测'),
  /** 单次转写音频时长上限（秒）。方案给的区间是 60~1800。 */
  asrMaxSeconds: z.number().default(300).description('单次转写最多取多少秒音频（60~1800）'),
  /** 转写超时。长音频 + 小模型很慢，默认给足。 */
  asrTimeoutMs: z.number().default(600000).description('转写子进程超时（毫秒）'),
})

export type Config = ReturnType<typeof Config>
