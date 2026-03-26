import './globals.css'
import AuthProvider from "./components/AuthProvider"
import Web3Provider from "./components/Web3Provider"
import Chatbot from '@/components/Chatbot'

export const metadata = {
  title: "StegaSphere",
  description: "Multi-media data hiding & retrieval platform"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-gradient-to-b from-white to-zinc-100 dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
        <div className="max-w-7xl mx-auto px-4">
          <AuthProvider>
            <Web3Provider>
              {children}
              <Chatbot />
            </Web3Provider>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
