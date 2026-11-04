import "./globals.css";

export const metadata = {
  title: "NFT Authenticity Checker",
  description: "Demo: Was eine Blockchain bei NFTs garantiert – und was nicht.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
