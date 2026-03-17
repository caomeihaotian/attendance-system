"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export default function StudentNav({ userName }: { userName: string }) {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        </div>
        <Link href="/student/dashboard" className="text-white font-semibold text-sm">课堂点名</Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-purple-300 text-xs font-medium">
            {userName.charAt(0)}
          </div>
          <span className="text-slate-300 text-sm">{userName}</span>
          <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">学生</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-slate-500 hover:text-red-400 transition text-xs flex items-center gap-1"
        >
          退出
        </button>
      </div>
    </nav>
  );
}
