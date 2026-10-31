"use client";

// 이미지 보안 3단계 — useSecureImage로 그림을 그리는 공용 <img>.
// 권한 없음·파일 없음은 빈칸 대신 안내 상자를 보여 줍니다.
import { useSecureImage } from "@/lib/secureImage";

const FALLBACK_TEXT = {
  denied: "볼 수 있는 권한이 없는 그림이에요",
  missing: "그림을 찾을 수 없어요",
  unavailable: "지금은 그림을 불러올 수 없어요",
  invalid: "그림 주소가 올바르지 않아요",
  error: "그림을 불러오지 못했어요",
};

export default function SecureImage({ src, alt = "", className, style, fallback, ...rest }) {
  const img = useSecureImage(src);
  if (img.status === "ready") {
    return <img src={img.url} alt={alt} className={className} style={style} {...rest} />;
  }
  if (img.status === "error") {
    if (fallback !== undefined) return fallback;
    return (
      <span role="img" aria-label={alt || FALLBACK_TEXT[img.reason] || FALLBACK_TEXT.error}
        className={className} data-secure-image-error={img.reason}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
          minHeight: 48, padding: 8, fontSize: 12, color: "#6b7280", background: "#f3f4f6",
          borderRadius: 8, ...style }}>
        {FALLBACK_TEXT[img.reason] || FALLBACK_TEXT.error}
      </span>
    );
  }
  return <span aria-busy="true" className={className}
    style={{ display: "inline-block", minHeight: 48, background: "#f3f4f6", borderRadius: 8, ...style }} />;
}
