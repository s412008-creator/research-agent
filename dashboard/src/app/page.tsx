import Link from 'next/link';
import { Building2, FileText, Users, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Official Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="bg-[#0F172A] text-white py-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center text-xs font-medium">
            <ShieldCheck className="w-4 h-4 mr-2 text-[#C6A87C]" />
            Official Portal of the Dubai Digital Infrastructure
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0F172A] text-white rounded flex items-center justify-center font-bold text-lg">
              AE
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0F172A] leading-tight">Oasis.ai</h1>
              <p className="text-sm text-slate-500">Government Services Portal</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-[#0F172A]">
            <Link href="/" className="hover:text-[#C6A87C] transition-colors">Home</Link>
            <Link href="#" className="hover:text-[#C6A87C] transition-colors">Services</Link>
            <Link href="#" className="hover:text-[#C6A87C] transition-colors">Regulations</Link>
            <Link href="#" className="hover:text-[#C6A87C] transition-colors">Help & Support</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white border-b border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <h2 className="text-4xl font-extrabold text-[#0F172A] tracking-tight sm:text-5xl">
            Welcome to your digital <span className="text-[#C6A87C]">gateway to Dubai.</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Access automated, AI-driven government services for foreign investors. Fast, secure, and fully compliant with UAE regulations.
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <main className="flex-1 bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-[#0F172A] mb-8 border-l-4 border-[#C6A87C] pl-3">
            Available Services
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Module 1: Relocation Concierge */}
            <Link href="/relocation" className="group">
              <div className="gov-card p-8 h-full flex flex-col relative overflow-hidden">
                <div className="w-12 h-12 bg-blue-50 text-[#0F172A] rounded-lg flex items-center justify-center mb-6">
                  <Building2 className="w-6 h-6" />
                </div>
                <h4 className="text-xl font-bold text-[#0F172A] mb-3">Smart Relocation Concierge</h4>
                <p className="text-slate-600 mb-8 flex-1">
                  Automated advisory for company setup, Golden Visa eligibility, and corporate tax calculation in Dubai Free Zones.
                </p>
                <div className="flex items-center text-[#C6A87C] font-semibold group-hover:translate-x-2 transition-transform">
                  Access Service <ArrowRight className="w-4 h-4 ml-2" />
                </div>
                <div className="absolute top-0 left-0 w-full h-1 bg-[#C6A87C] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
              </div>
            </Link>

            {/* Module 2: Document Translator */}
            <div className="gov-card p-8 h-full flex flex-col relative opacity-75 cursor-not-allowed">
              <div className="absolute top-4 right-4 bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded uppercase">Coming Soon</div>
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center mb-6">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold text-slate-400 mb-3">AI Document Auditor</h4>
              <p className="text-slate-400 mb-8 flex-1">
                Upload foreign contracts for instant Arabic translation and UAE commercial law compliance checks.
              </p>
              <div className="flex items-center text-slate-400 font-semibold">
                Service Unavailable
              </div>
            </div>

            {/* Module 3: B2B Matchmaking */}
            <div className="gov-card p-8 h-full flex flex-col relative opacity-75 cursor-not-allowed">
              <div className="absolute top-4 right-4 bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded uppercase">Coming Soon</div>
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center mb-6">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold text-slate-400 mb-3">B2B Matchmaking Bureau</h4>
              <p className="text-slate-400 mb-8 flex-1">
                Discover potential UAE clients or suppliers and auto-generate bilingual introductory communications.
              </p>
              <div className="flex items-center text-slate-400 font-semibold">
                Service Unavailable
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Official Footer */}
      <footer className="bg-[#0F172A] text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h5 className="text-white font-bold text-lg mb-4">Oasis.ai Portal</h5>
            <p className="text-sm leading-relaxed max-w-sm">
              The official AI-powered gateway for foreign investment and corporate relocation to Dubai. Built on Multi-Agent architectures to ensure enterprise readiness and regulatory compliance.
            </p>
          </div>
          <div>
            <h5 className="text-white font-bold mb-4">Services</h5>
            <ul className="space-y-2 text-sm">
              <li><Link href="/relocation" className="hover:text-white">Relocation Advisory</Link></li>
              <li><span className="opacity-50">Document Audit</span></li>
              <li><span className="opacity-50">Business Matchmaking</span></li>
            </ul>
          </div>
          <div>
            <h5 className="text-white font-bold mb-4">Legal</h5>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-white">Terms of Use</Link></li>
              <li><Link href="#" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-white">Accessibility</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
