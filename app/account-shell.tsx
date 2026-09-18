import {CalendarDays, ArrowLeft} from 'lucide-react';
import type {ReactNode} from 'react';
import Link from 'next/link';

export default function AccountShell({children}: {children: ReactNode}) {
  return <div className="account-shell"><header className="account-header"><Link prefetch={false} className="brand" href="/"><span className="brand-mark"><CalendarDays size={23}/></span><span>BYU<span className="brand-light"> Calendar</span></span></Link><Link prefetch={false} className="text-button" href="/"><ArrowLeft size={15}/> Back to calendar</Link></header><main className="account-main">{children}</main><footer className="account-footer">Independent student project · Not an official BYU service · <Link prefetch={false} href="/privacy">Privacy</Link></footer></div>;
}
