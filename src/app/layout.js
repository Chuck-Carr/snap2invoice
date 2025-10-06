import "../app/globals.css";

export const metadata = {
  title: 'Snap2Invoice',
  description: 'Snap a receipt, get an invoice',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
