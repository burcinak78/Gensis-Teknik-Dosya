// Gensis logosu. Gerçek görsel: public/logo.png
// - dark  : açık zeminde doğrudan gösterilir (giriş ekranı, beyaz kart)
// - light : lacivert kenar menüde görünür olması için beyaz bir kutu içine alınır
//           (orijinal logodaki lacivert yazı koyu zeminde kaybolmasın diye)

export default function Logo({
  variant = "dark",
  height = 30,
}: {
  variant?: "dark" | "light";
  height?: number;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="GENSIS"
      style={{ height, width: "auto", display: "block" }}
    />
  );

  if (variant === "light") {
    return (
      <div
        style={{
          background: "#ffffff",
          borderRadius: 8,
          padding: "6px 10px",
          display: "inline-block",
        }}
      >
        {img}
      </div>
    );
  }
  return img;
}
