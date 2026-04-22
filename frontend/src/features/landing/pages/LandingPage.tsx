import { Link } from "react-router-dom"
import {
  ArrowRight,
  BadgeIndianRupee,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Mail,
  Phone,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

const featureHighlights = [
  {
    icon: Receipt,
    title: "Bill faster",
    description: "Generate invoices in seconds for saved customers or walk-ins with clean totals and downloadable bills.",
  },
  {
    icon: Warehouse,
    title: "Track stock live",
    description: "See incoming stock, low-stock alerts, and product movement before shelves run empty.",
  },
  {
    icon: Wallet,
    title: "Watch profit daily",
    description: "Revenue, expenses, and net profit stay visible without waiting for end-of-day calculations.",
  },
]

const coreFeatures = [
  {
    icon: Users,
    title: "Customer memory",
    description: "Walk-in buyers can be captured by phone number and seen again on their next visit.",
  },
  {
    icon: BarChart2,
    title: "Business dashboard",
    description: "Get a clean owner view of invoices, expenses, profit trends, and low-stock pressure.",
  },
  {
    icon: BadgeIndianRupee,
    title: "Expense visibility",
    description: "Daily spend is tracked alongside revenue, so margin problems appear early.",
  },
  {
    icon: ShieldCheck,
    title: "Owner and staff roles",
    description: "Staff can bill fast while owners keep access to customers, suppliers, settings, and reports.",
  },
  {
    icon: Smartphone,
    title: "Works on any screen",
    description: "Use it on a shop desktop, a tablet near the counter, or a phone during stock checks.",
  },
  {
    icon: CircleHelp,
    title: "Built-in support",
    description: "Teams can raise in-app support tickets and new stores can contact you before onboarding.",
  },
]

const stats = [
  { label: "Billing time", value: "Seconds" },
  { label: "Devices", value: "Desktop to mobile" },
  { label: "Onboarding", value: "Hands-on support" },
]

const workflow = [
  {
    step: "01",
    title: "Add products once",
    description: "Set prices, stock thresholds, and suppliers so the counter team stops guessing.",
  },
  {
    step: "02",
    title: "Bill every sale quickly",
    description: "Pick items, save walk-ins when needed, and finish payment without hunting through spreadsheets.",
  },
  {
    step: "03",
    title: "Review the business daily",
    description: "Owners can see revenue, expenses, low stock, and customer history in one place.",
  },
]

const faqs = [
  {
    question: "Is this suitable for a small local shop?",
    answer: "Yes. The current flow is designed around fast billing, product lookup, stock tracking, and simple staff access for retail counters.",
  },
  {
    question: "Can staff use it without seeing everything?",
    answer: "Yes. Staff can focus on billing while owner-only areas remain restricted for customers, suppliers, and admin settings.",
  },
  {
    question: "Can we get setup help before using it?",
    answer: "Yes. Use the Contact page to request pricing, onboarding support, or a walkthrough for your store.",
  },
]

const contactDetails = [
  { icon: Store, label: "Best Fit", value: "Retail stores and counters" },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.15),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.12),_transparent_22%),linear-gradient(180deg,_#f7fbfb_0%,_#ffffff_42%,_#f8fafc_100%)] text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/78 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <Store className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Shrivo</p>
              <p className="text-xs text-muted-foreground">Retail billing and inventory</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Link to="/contact">
              <Button variant="ghost" size="sm">Contact</Button>
            </Link>
            <Link to="/login">
              <Button size="sm">Sign In <ArrowRight className="size-3.5" /></Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-16">
          <div className="space-y-8">
            <div className="space-y-5">
              <Badge variant="secondary" className="rounded-full border-0 bg-teal-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-800">
                Built for fast retail counters
              </Badge>
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Billing, stock, and daily shop control without the clutter.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Run invoices faster, save walk-in customer history, monitor low stock, and keep owner-level business visibility in one focused application.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/login">
                <Button size="lg" className="w-full sm:w-auto">
                  Start billing
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/contact">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Talk to us
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-border/60 bg-white/75 p-4 shadow-sm backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {featureHighlights.map((feature) => (
                <Card key={feature.title} className="border-border/60 bg-white/80 shadow-sm backdrop-blur-sm">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                      <feature.icon className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight text-slate-950">{feature.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-4 top-12 hidden h-24 w-24 rounded-full bg-amber-200/50 blur-3xl lg:block" />
            <div className="absolute right-0 top-0 hidden h-28 w-28 rounded-full bg-teal-200/60 blur-3xl lg:block" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-slate-950 p-5 text-white shadow-[0_35px_80px_rgba(15,23,42,0.18)] sm:p-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.25),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.2),_transparent_28%)]" />
              <div className="relative space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Owner snapshot</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">Today at a glance</p>
                  </div>
                  <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-teal-200">
                    Live view
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-sm">Revenue</span>
                      <BadgeIndianRupee className="size-4" />
                    </div>
                    <p className="mt-3 text-3xl font-semibold">₹18,420</p>
                    <p className="mt-1 text-xs text-emerald-300">12 invoices processed</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-sm">Net Profit</span>
                      <Sparkles className="size-4" />
                    </div>
                    <p className="mt-3 text-3xl font-semibold">₹11,080</p>
                    <p className="mt-1 text-xs text-amber-200">Expenses synced for the day</p>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-white/10 bg-white/7 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Low stock focus</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-300">3 items</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      ["Basmati Rice 5kg", "4 left"],
                      ["Sunflower Oil 1L", "6 left"],
                      ["Soap Bar Pack", "2 left"],
                    ].map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{name}</p>
                          <p className="text-xs text-slate-400">Reorder recommended</p>
                        </div>
                        <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-medium text-amber-200">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-white/10 bg-white/7 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Recent customer capture</p>
                    <Users className="size-4 text-slate-300" />
                  </div>
                  <p className="mt-3 text-sm text-slate-300">
                    Walk-in customers saved by mobile number can be reused for repeat billing and purchase history.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-slate-950 py-16 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.22em] text-teal-200">Why teams switch</p>
                <h2 className="text-3xl font-semibold tracking-tight">A cleaner operating rhythm for your store.</h2>
                <p className="max-w-lg text-sm leading-6 text-slate-300">
                  The app is organized around the tasks that matter at the counter and in daily review, not around complicated menus.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {coreFeatures.map((feature) => (
                  <Card key={feature.title} className="border-white/10 bg-white/6 text-white shadow-none">
                    <CardContent className="space-y-3 p-5">
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-teal-200">
                        <feature.icon className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight">{feature.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{feature.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-4 lg:grid-cols-3">
              {workflow.map((item) => (
                <Card key={item.step} className="border-border/60 bg-white/80 shadow-sm backdrop-blur-sm">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Step {item.step}</span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight text-slate-950">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_0.92fr] lg:px-8">
            <Card className="overflow-hidden border-border/60 bg-[linear-gradient(135deg,_rgba(15,23,42,1)_0%,_rgba(30,41,59,1)_65%,_rgba(13,148,136,0.88)_140%)] text-white shadow-[0_28px_70px_rgba(15,23,42,0.18)]">
              <CardContent className="space-y-5 p-8 sm:p-10">
                <p className="text-xs uppercase tracking-[0.22em] text-teal-200">From the floor</p>
                <p className="max-w-2xl text-2xl font-medium leading-10 tracking-tight sm:text-3xl">
                  “What used to take 10 minutes at billing now takes seconds. Low-stock visibility alone changed how we reorder.”
                </p>
                <div>
                  <p className="text-sm font-semibold">Rajesh Sharma</p>
                  <p className="text-sm text-slate-300">Owner, Sharma General Store</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {faqs.map((faq) => (
                <Card key={faq.question} className="border-border/60 bg-white/80 shadow-sm backdrop-blur-sm">
                  <CardContent className="space-y-2 p-6">
                    <h3 className="text-base font-semibold tracking-tight">{faq.question}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 rounded-[2rem] border border-border/60 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="space-y-5">
                <Badge className="rounded-full border-0 bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800 hover:bg-amber-100">
                  Start with guided onboarding
                </Badge>
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    Want to try it for your store?
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Contact us for pricing, rollout help, or a walkthrough tailored to your billing and stock process.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {contactDetails.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border/70 bg-slate-50 p-4">
                      <item.icon className="size-4 text-teal-700" />
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-sm font-medium text-slate-950">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Card className="border-border/60 bg-slate-950 text-white shadow-none">
                <CardContent className="space-y-5 p-8">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-teal-200">Next step</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">Speak with the team</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Tell us about your shop size, billing volume, or stock pain points. We will suggest the right setup path.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link to="/contact" className="flex-1">
                      <Button className="w-full" size="lg">
                        Open contact form
                        <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                    <Link to="/login" className="flex-1">
                      <Button variant="outline" size="lg" className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                        Sign in
                      </Button>
                    </Link>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    {[
                      "No credit card required to start discussions",
                      "Support available during onboarding",
                      "Suitable for owner-led and staff-led counters",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-teal-200" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <footer className="border-t border-border/60 bg-background/70 py-6 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>© 2026 Shrivo. Retail billing and inventory workflow.</p>
            <div className="flex items-center gap-4">
              <Link to="/contact" className="transition-colors hover:text-foreground">Contact</Link>
              <Link to="/login" className="transition-colors hover:text-foreground">Sign In</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
