import "../app/globals.css";
import { AuthProvider } from '../contexts/AuthContext';

export const metadata = {
  title: 'Snap2Invoice',
  description: 'Snap a receipt, get an invoice',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
