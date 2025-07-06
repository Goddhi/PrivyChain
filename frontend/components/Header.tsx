import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { formatAddress } from "../utils/web3";

interface HeaderProps {
  userAddress: string | null;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

const Header = ({
  userAddress,
  isConnected,
  onConnect,
  onDisconnect,
}: HeaderProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

  const isActivePage = (path: string) => {
    return router.pathname === path;
  };

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-filecoin-500 to-privy-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="ml-3 text-xl font-bold gradient-text">
                PrivyChain
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link
              href="/"
              className={`px-3 py-2 text-sm font-medium ${
                isActivePage("/")
                  ? "text-filecoin-600 border-b-2 border-filecoin-600"
                  : "text-gray-600 hover:text-filecoin-600"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/files"
              className={`px-3 py-2 text-sm font-medium ${
                isActivePage("/files")
                  ? "text-filecoin-600 border-b-2 border-filecoin-600"
                  : "text-gray-600 hover:text-filecoin-600"
              }`}
            >
              My Files
            </Link>
            <Link
              href="/rewards"
              className={`px-3 py-2 text-sm font-medium ${
                isActivePage("/rewards")
                  ? "text-filecoin-600 border-b-2 border-filecoin-600"
                  : "text-gray-600 hover:text-filecoin-600"
              }`}
            >
              Rewards
            </Link>
          </nav>

          {/* Wallet Connection */}
          <div className="flex items-center space-x-4">
            {isConnected ? (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600 font-medium">
                    {formatAddress(userAddress || "")}
                  </span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200">
                    <div className="py-1">
                      <button
                        onClick={onDisconnect}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={onConnect} className="btn-primary">
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
