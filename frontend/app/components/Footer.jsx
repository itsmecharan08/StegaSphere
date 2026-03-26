export default function Footer() {
  const currentYear = new Date().getFullYear();
  const footerLinks = [
    { name: "Privacy Policy", href: "#privacy" },
    { name: "Terms of Service", href: "#terms" },
    { name: "Contact", href: "#contact" },
    { name: "GitHub", href: "https://github.com" },
  ];

  const socialLinks = [
    { name: "Twitter", href: "#", icon: "🐦" },
    { name: "GitHub", href: "#", icon: "💻" },
    { name: "Discord", href: "#", icon: "💬" },
  ];

  return (
    <footer className="bg-gradient-to-t from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 border-t border-zinc-200 dark:border-zinc-800 mt-20 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
          {/* Product Section */}
          <div className="w-full">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-wider uppercase">
              Product
            </h3>
            <ul className="mt-4 space-y-2">
              <li><a href="/#features" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a></li>
              <li><a href="/#tools" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Tools</a></li>
              {/* <li><a href="#pricing" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</a></li> */}
            </ul>
          </div>

          {/* Resources Section */}
          <div className="w-full">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-wider uppercase">
              Resources
            </h3>
            <ul className="mt-4 space-y-2">
              <li><a href="/docs" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Documentation</a></li>
              <li><a href="/tutorials" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Tutorials</a></li>
              <li><a href="/blog" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Blog</a></li>
            </ul>
          </div>

          {/* Company Section */}
          <div className="w-full">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-wider uppercase">
              Company
            </h3>
            <ul className="mt-4 space-y-2">
              <li><a href="/about" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About</a></li>
              <li><a href="/careers" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Careers</a></li>
              <li><a href="/press" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Press</a></li>
            </ul>
          </div>

          {/* Newsletter Section */}
          <div className="w-full">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-wider uppercase">
              Stay updated
            </h3>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Subscribe to our newsletter for the latest updates.
            </p>
            <div className="mt-4 flex w-full">
              <input
                type="email"
                placeholder="Your email"
                className="flex-1 min-w-0 px-4 py-2 rounded-l-lg border border-r-0 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button className="px-4 py-2 rounded-r-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center w-full">
          <div className="flex items-center space-x-6">
            {socialLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-xl"
                aria-label={link.name}
              >
                {link.icon}
              </a>
            ))}
          </div>

          <div className="mt-4 md:mt-0 flex flex-wrap justify-center gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <span
                key={link.name}
                className="text-zinc-400 dark:text-zinc-600 text-sm whitespace-nowrap cursor-not-allowed"
              >
                {link.name}
              </span>
            ))}
          </div>

          <p className="mt-4 md:mt-0 text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
            © {currentYear} StegaSphere. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}