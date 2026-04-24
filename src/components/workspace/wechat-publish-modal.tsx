"use client";

import { useEffect, useMemo, useState } from "react";

type WechatArticleType = "news" | "newspic";

type WechatAccount = {
  name: string;
  wechatAppid: string;
  username?: string;
  type?: string;
};

type WechatAccountsPayload = {
  accounts?: WechatAccount[];
  total?: number;
  message?: string;
};

type WechatPublishModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (input: { wechatAppid: string; articleType: WechatArticleType }) => void;
};

export function WechatPublishModal(props: WechatPublishModalProps) {
  const [accounts, setAccounts] = useState<WechatAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [wechatAppid, setWechatAppid] = useState("");
  const [articleType, setArticleType] = useState<WechatArticleType>("news");

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    let isMounted = true;

    async function loadAccounts() {
      setIsLoadingAccounts(true);
      setErrorText("");

      try {
        const response = await fetch("/api/wechat/accounts", {
          method: "POST"
        });
        const payload = (await response.json()) as WechatAccountsPayload;

        if (!response.ok) {
          throw new Error(payload.message ?? "获取公众号列表失败");
        }

        const nextAccounts = payload.accounts ?? [];

        if (!isMounted) {
          return;
        }

        setAccounts(nextAccounts);
        setWechatAppid((current) => current || nextAccounts[0]?.wechatAppid || "");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAccounts([]);
        setWechatAppid("");
        setErrorText(error instanceof Error ? error.message : "获取公众号列表失败");
      } finally {
        if (isMounted) {
          setIsLoadingAccounts(false);
        }
      }
    }

    void loadAccounts();

    return () => {
      isMounted = false;
    };
  }, [props.isOpen]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.wechatAppid === wechatAppid) ?? null,
    [accounts, wechatAppid]
  );

  if (!props.isOpen) {
    return null;
  }

  return (
    <div className="wechat-publish-modal__backdrop" role="presentation">
      <div
        aria-labelledby="wechat-publish-modal-title"
        aria-modal="true"
        className="wechat-publish-modal"
        role="dialog"
      >
        <header className="wechat-publish-modal__header">
          <div>
            <p className="wechat-publish-modal__eyebrow">发布管理</p>
            <h3 id="wechat-publish-modal-title">选择发布公众号</h3>
          </div>
          <button
            aria-label="关闭发布弹窗"
            className="wechat-publish-modal__close"
            onClick={props.onClose}
            type="button"
          >
            关闭
          </button>
        </header>

        <div className="wechat-publish-modal__body">
          <label className="wechat-publish-modal__field">
            <span>发布到</span>
            <select
              disabled={isLoadingAccounts || props.isSubmitting || accounts.length === 0}
              onChange={(event) => setWechatAppid(event.target.value)}
              value={wechatAppid}
            >
              {accounts.length === 0 ? <option value="">暂无可用公众号</option> : null}
              {accounts.map((account) => (
                <option key={account.wechatAppid} value={account.wechatAppid}>
                  {account.name}
                </option>
              ))}
            </select>
            {selectedAccount ? (
              <small>
                AppID: {selectedAccount.wechatAppid}
                {selectedAccount.username ? ` · 原始ID: ${selectedAccount.username}` : ""}
              </small>
            ) : null}
          </label>

          <fieldset className="wechat-publish-modal__field">
            <legend>发布类型</legend>
            <div className="wechat-publish-modal__types">
              <label>
                <input
                  checked={articleType === "news"}
                  name="wechat-article-type"
                  onChange={() => setArticleType("news")}
                  type="radio"
                />
                <span>公众号文章</span>
              </label>
              <label>
                <input
                  checked={articleType === "newspic"}
                  name="wechat-article-type"
                  onChange={() => setArticleType("newspic")}
                  type="radio"
                />
                <span>小绿书（图文）</span>
              </label>
            </div>
          </fieldset>

          {isLoadingAccounts ? (
            <p className="wechat-publish-modal__hint">正在获取公众号列表...</p>
          ) : null}
          {errorText ? <p className="wechat-publish-modal__error">{errorText}</p> : null}
        </div>

        <footer className="wechat-publish-modal__footer">
          <button
            className="wechat-publish-modal__secondary"
            disabled={props.isSubmitting}
            onClick={props.onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="wechat-publish-modal__primary"
            disabled={
              props.isSubmitting || isLoadingAccounts || !wechatAppid || accounts.length === 0
            }
            onClick={() => props.onConfirm({ wechatAppid, articleType })}
            type="button"
          >
            {props.isSubmitting ? "发布中..." : "确认发布"}
          </button>
        </footer>
      </div>
    </div>
  );
}
