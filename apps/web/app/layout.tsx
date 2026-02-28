import "./globals.css";
import { AuthProvider } from "./components/auth/AuthContext";
import Nav from "./components/ui/Nav";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
            try {
              var house = localStorage.getItem('house');
              if (house) document.documentElement.setAttribute('data-house', house);
            } catch(e) {}
          `,
          }}
        />
      </head>
      <body>
        <AuthProvider>
          <Nav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
