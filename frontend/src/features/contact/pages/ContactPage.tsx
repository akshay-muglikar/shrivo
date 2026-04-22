import { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ArrowLeft, ArrowRight, Building2, Mail, MessageSquare, Phone, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createContactLead } from "../api/contact.api"

interface ContactFormValues {
  name: string
  email: string
  phone: string
  business_name: string
  message: string
}

const reasons = [
  "Book a product demo",
  "Need pricing for my shop",
  "Switching from manual billing",
  "Want inventory setup guidance",
]

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactFormValues>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      business_name: "",
      message: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (values: ContactFormValues) =>
      createContactLead({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || null,
        business_name: values.business_name.trim() || null,
        message: values.message.trim(),
      }),
    onSuccess: () => {
      setSubmitted(true)
      reset()
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? "Could not submit your message")
    },
  })

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_28%),linear-gradient(180deg,_#f6fbfa_0%,_#ffffff_48%,_#f8fafc_100%)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-2">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
          <Link to="/login">
            <Button variant="outline" size="sm">Sign In</Button>
          </Link>
        </div>

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-slate-950 px-6 py-8 text-slate-50 shadow-[0_30px_80px_rgba(15,23,42,0.2)] sm:px-8 sm:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.22),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.18),_transparent_26%)]" />
            <div className="relative space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs uppercase tracking-[0.22em] text-teal-200">
                  <Sparkles className="size-3.5" />
                  New store onboarding
                </div>
                <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  Tell us about your shop. We will help you get started fast.
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  Whether you need better billing, stock visibility, or a cleaner staff workflow, we can map the product to your setup and show you how it will work in practice.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {reasons.map((reason) => (
                  <div key={reason} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-100 backdrop-blur-sm">
                    {reason}
                  </div>
                ))}
              </div>

              <Card className="border-white/10 bg-white/6 text-slate-50 shadow-none">
                <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
                
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Support window</p>
                    <p className="text-sm font-medium">Daily, 24/7</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-[2rem] border-border/70 bg-background/92 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <CardContent className="p-6 sm:p-8">
              {submitted ? (
                <div className="flex h-full min-h-[32rem] flex-col items-start justify-center gap-5">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">
                    Inquiry sent
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-semibold tracking-tight">We have your details.</h2>
                    <p className="max-w-md text-sm leading-6 text-muted-foreground">
                      We will review your message and get back to you shortly with the next step, whether that is pricing, onboarding help, or a walkthrough.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={() => setSubmitted(false)} variant="outline">Send another message</Button>
                    <Link to="/">
                      <Button>
                        Return to home
                        <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-700">Contact us</p>
                    <h2 className="text-3xl font-semibold tracking-tight">Book a conversation</h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Share a few details and we will contact you with the right onboarding plan for your business.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="contact_name">Your name *</Label>
                      <Input id="contact_name" placeholder="Akshay" aria-invalid={!!errors.name} {...register("name", { required: true, minLength: 2 })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact_business">Business name</Label>
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="contact_business" placeholder="City Mart" className="pl-9" {...register("business_name")} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact_email">Email *</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="contact_email" type="email" placeholder="you@shop.com" className="pl-9" aria-invalid={!!errors.email} {...register("email", { required: true })} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact_phone">Phone</Label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="contact_phone" placeholder="9876543210" className="pl-9" {...register("phone")} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="contact_message">What do you need help with? *</Label>
                    <div className="relative">
                      <MessageSquare className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                      <Textarea
                        id="contact_message"
                        rows={7}
                        className="pl-9"
                        placeholder="Tell us about your current billing or stock process, team size, and what you want to improve."
                        aria-invalid={!!errors.message}
                        {...register("message", { required: true, minLength: 10 })}
                      />
                    </div>
                  </div>

                  <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={mutation.isPending}>
                    {mutation.isPending ? "Submitting..." : "Send inquiry"}
                    {!mutation.isPending && <ArrowRight className="size-4" />}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}