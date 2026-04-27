import type { PersistedTwitterContent, TwitterMode } from "@/lib/types";

const modes: TwitterMode[] = ["auto", "single", "thread"];

function stripThreadPrefix(tweet: string) {
  return tweet
    .replace(/^\s*\d+\s*\/\s*\d+\s*/u, "")
    .replace(/^\s*\d+[.、]\s*/u, "")
    .trim();
}

function tidyTweet(tweet: string) {
  return tweet.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function buildSingleTweet(tweets: string[]) {
  const merged = tweets.map(stripThreadPrefix).filter(Boolean).join(" ");

  return tidyTweet(merged);
}

function buildThreadDraft(tweets: string[]) {
  const cleanTweets = tweets.map(stripThreadPrefix).filter(Boolean);

  if (cleanTweets.length > 1) {
    return cleanTweets.map(tidyTweet);
  }

  const source = cleanTweets[0] ?? "";
  const parts = source
    .split(/(?<=[。！？!?])\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 1 ? parts.map(tidyTweet) : [tidyTweet(source)];
}

function convertTweetsForMode(tweets: string[], mode: TwitterMode) {
  if (mode === "single") {
    return [buildSingleTweet(tweets)];
  }

  if (mode === "thread") {
    return buildThreadDraft(tweets);
  }

  return tweets;
}

function getModeHelp(mode: TwitterMode) {
  if (mode === "single") {
    return "当前先把已有内容收拢成一条可编辑推文；下一次重新生成会强制输出一条推文。";
  }

  if (mode === "thread") {
    return "当前按连续推文编辑；下一次重新生成会强制输出 Thread，并保留起承转合。";
  }

  return "Auto 会让模型根据需求复杂度自动选择 Single 或 Thread。";
}

function isEnglishLanguage(language: string) {
  return /^(en|english)$/iu.test(language.trim());
}

function containsHanCharacters(value: string) {
  return /\p{Script=Han}/u.test(value);
}

function getLanguageGuardText(language: string, tweets: string[]) {
  if (isEnglishLanguage(language) && tweets.some(containsHanCharacters)) {
    return "当前草稿含中文，重新生成时会自动修正为 English。";
  }

  return `当前目标语言：${language || "English"}。`;
}

export function TwitterEditor(props: {
  value: PersistedTwitterContent;
  isEditing: boolean;
  onChange: (value: PersistedTwitterContent) => void;
}) {
  const language = props.value.language ?? "English";

  function updateTweet(index: number, nextValue: string) {
    const nextTweets = [...props.value.tweets];
    nextTweets[index] = nextValue;
    props.onChange({ ...props.value, tweets: nextTweets });
  }

  function updateMode(mode: TwitterMode) {
    props.onChange({
      ...props.value,
      mode,
      tweets: convertTweetsForMode(props.value.tweets, mode)
    });
  }

  function updateLanguage(nextLanguage: string) {
    props.onChange({
      ...props.value,
      language: nextLanguage
    });
  }

  const sectionTitle = props.value.mode === "single" ? "Single Tweet" : "Thread";
  const longestTweetLength = Math.max(
    0,
    ...props.value.tweets.map((tweet) => tweet.length)
  );
  const hasOverLimitTweet = props.value.tweets.some((tweet) => tweet.length > 280);
  const languageGuardText = getLanguageGuardText(language, props.value.tweets);

  return (
    <section className="editor-surface editor-surface--stacked">
      <div className="twitter-command-panel">
        <div className="twitter-command-panel__main">
          <div className="editor-inline-group">
            <span className="editor-inline-group__label">输出模式</span>
            <div className="editor-inline-group__controls">
              {modes.map((mode) => (
                <button
                  className={`editor-chip${props.value.mode === mode ? " editor-chip--active" : ""}`}
                  key={mode}
                  onClick={() => updateMode(mode)}
                  type="button"
                >
                  {mode === "auto"
                    ? "Auto"
                    : mode === "single"
                      ? "Single"
                      : "Thread"}
                </button>
              ))}
            </div>
          </div>

          <div className="editor-inline-group editor-inline-group--language">
            <label className="editor-inline-group__label" htmlFor="twitter-language">
              生成语言
            </label>
            <input
              aria-label="Twitter 生成语言"
              className="editor-language-input"
              id="twitter-language"
              list="twitter-language-options"
              onChange={(event) => updateLanguage(event.target.value)}
              placeholder="English（默认）"
              value={language}
            />
            <datalist id="twitter-language-options">
              <option value="English" />
              <option value="中文" />
              <option value="Japanese" />
              <option value="Korean" />
              <option value="Spanish" />
              <option value="French" />
            </datalist>
            <span className="editor-inline-group__hint">不填写时默认 English。</span>
          </div>
        </div>

        <div className="twitter-command-panel__guards" aria-label="Twitter 生成状态">
          <div className="twitter-guard-card">
            <span>语言守卫</span>
            <strong>{isEnglishLanguage(language) ? "English lock" : language}</strong>
            <p>{languageGuardText}</p>
          </div>
          <div className="twitter-guard-card">
            <span>字符预算</span>
            <strong className={hasOverLimitTweet ? "twitter-guard-card__danger" : ""}>
              {longestTweetLength} chars
            </strong>
            <p>{hasOverLimitTweet ? "有推文超过限制，建议压缩。" : "每条推文均在限制内。"}</p>
          </div>
        </div>
      </div>

      <div className="editor-section">
        <div className="editor-section__heading">
          <h3>{sectionTitle}</h3>
          <p>{getModeHelp(props.value.mode)}</p>
        </div>
        <div className="editor-grid">
          {props.value.tweets.map((tweet, index) => (
            <label className="editor-field" key={`${index + 1}-${tweet}`}>
              <span className="editor-field__topline">
                <span>Tweet {index + 1}</span>
                <small className={tweet.length > 280 ? "twitter-char-count--danger" : ""}>
                  {tweet.length} / 280
                </small>
              </span>
              <textarea
                aria-label={`Tweet ${index + 1}`}
                onChange={(event) => updateTweet(index, event.target.value)}
                readOnly={!props.isEditing}
                rows={4}
                value={tweet}
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
