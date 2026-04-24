"use client";

type XiaohongshuPublishConfirmModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function XiaohongshuPublishConfirmModal(
  props: XiaohongshuPublishConfirmModalProps
) {
  if (!props.isOpen) {
    return null;
  }

  return (
    <div className="wechat-publish-modal__backdrop" role="presentation">
      <div
        aria-labelledby="xiaohongshu-publish-confirm-title"
        aria-modal="true"
        className="wechat-publish-modal xiaohongshu-publish-confirm-modal"
        role="dialog"
      >
        <header className="wechat-publish-modal__header">
          <div>
            <p className="wechat-publish-modal__eyebrow">发布确认</p>
            <h3 id="xiaohongshu-publish-confirm-title">确认创建小红书发布链接</h3>
          </div>
          <button
            aria-label="关闭发布确认弹窗"
            className="wechat-publish-modal__close"
            onClick={props.onClose}
            type="button"
          >
            关闭
          </button>
        </header>

        <div className="wechat-publish-modal__body">
          <p className="wechat-publish-modal__hint">
            当前开放接口不会返回账号列表。系统会基于已配置 API Key 创建发布链接。
          </p>
          <p className="wechat-publish-modal__hint">
            点击确认后，只会生成链接和二维码，不会直接发到某个账号。你需要在手机端扫码后选择/登录账号完成最终发布。
          </p>
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
            disabled={props.isSubmitting}
            onClick={props.onConfirm}
            type="button"
          >
            {props.isSubmitting ? "创建中..." : "确认创建链接"}
          </button>
        </footer>
      </div>
    </div>
  );
}
