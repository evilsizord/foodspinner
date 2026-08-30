import "./globals.css";

export const metadata = {
  title: "Foodspinner",
  description: "Spin a wheel from your Google Sheet restaurants",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
