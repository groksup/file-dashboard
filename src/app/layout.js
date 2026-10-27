import "./globals.css";

export const metadata = {
  title: "Idea Validation Desk",
  description: "Store and read research files from the validation bots.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
