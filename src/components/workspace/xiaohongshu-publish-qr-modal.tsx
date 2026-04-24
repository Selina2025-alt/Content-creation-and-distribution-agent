"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

type XiaohongshuPublishQrModalProps = {
  isOpen: boolean;
  publishUrl: string | null;
  qrImageUrl?: string;
  noteId?: string;
  onClose: () => void;
};

export function XiaohongshuPublishQrModal(props: XiaohongshuPublishQrModalProps) {
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState("");
  const [copyStatusText, setCopyStatusText] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!props.isOpen || !props.publishUrl) {
      setGeneratedQrDataUrl("");
      setCopyStatusText("");
      setErrorText("");
      return;
    }

    let isCancelled = false;
    setGeneratedQrDataUrl("");
    setCopyStatusText("");
    setErrorText("");

    void QRCode.toDataURL(props.publishUrl, {
      margin: 1,
      width: 320
    })
      .then((dataUrl) => {
        if (!isCancelled) {
          setGeneratedQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setErrorText("Failed to generate QR image. You can still copy and open the link.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [props.isOpen, props.publishUrl]);

  if (!props.isOpen || !props.publishUrl) {
    return null;
  }

  const displayQr = generatedQrDataUrl || props.qrImageUrl || "";

  return (
    <div className="wechat-publish-modal__backdrop" role="presentation">
      <div
        aria-labelledby="xiaohongshu-publish-qr-title"
        aria-modal="true"
        className="wechat-publish-modal xiaohongshu-publish-qr-modal"
        role="dialog"
      >
        <header className="wechat-publish-modal__header">
          <div>
            <p className="wechat-publish-modal__eyebrow">发布结果</p>
            <h3 id="xiaohongshu-publish-qr-title">扫码继续发布到小红书</h3>
          </div>
          <button
            aria-label="Close publish QR modal"
            className="wechat-publish-modal__close"
            onClick={props.onClose}
            type="button"
          >
            关闭
          </button>
        </header>

        <div className="xiaohongshu-publish-qr-modal__body">
          {displayQr ? (
            <div className="xiaohongshu-publish-qr-modal__image-wrap">
              <Image
                alt="Xiaohongshu publish QR code"
                className="xiaohongshu-publish-qr-modal__image"
                height={320}
                src={displayQr}
                unoptimized
                width={320}
              />
            </div>
          ) : (
            <p className="wechat-publish-modal__hint">二维码生成中...</p>
          )}

          <p className="wechat-publish-modal__hint">
            已创建发布链接。当前接口不直接指定账号，需在手机端扫码后选择或登录小红书账号完成最终发布。
          </p>
          {props.noteId ? (
            <p className="wechat-publish-modal__hint">发布任务 ID：{props.noteId}</p>
          ) : null}
          <p className="xiaohongshu-publish-qr-modal__url">{props.publishUrl}</p>
          {errorText ? <p className="wechat-publish-modal__error">{errorText}</p> : null}
          {copyStatusText ? <p className="wechat-publish-modal__hint">{copyStatusText}</p> : null}
        </div>

        <footer className="wechat-publish-modal__footer">
          <button
            className="wechat-publish-modal__secondary"
            onClick={() => {
              void navigator.clipboard
                .writeText(props.publishUrl ?? "")
                .then(() => setCopyStatusText("已复制发布链接"))
                .catch(() =>
                  setCopyStatusText("自动复制失败，请手动复制链接。")
                );
            }}
            type="button"
          >
            复制链接
          </button>
          <a
            className="wechat-publish-modal__primary xiaohongshu-publish-qr-modal__open-link"
            href={props.publishUrl}
            rel="noreferrer noopener"
            target="_blank"
          >
            打开链接
          </a>
        </footer>
      </div>
    </div>
  );
}
