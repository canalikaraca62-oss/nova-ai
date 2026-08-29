"use client";

import Link from "next/link";
import { useState } from "react";

type Section = {
  id: string;
  title: string;
};

const sections: Section[] = [
  { id: "acceptance", title: "1. Acceptance of Terms" },
  { id: "eligibility", title: "2. Eligibility and Account" },
  { id: "services", title: "3. Our Services" },
  { id: "acceptable-use", title: "4. Acceptable Use" },
  { id: "content", title: "5. User Content" },
  { id: "ai", title: "6. AI and Automated Services" },
  { id: "billing", title: "7. Billing and Payments" },
  { id: "intellectual-property", title: "8. Intellectual Property" },
  { id: "security", title: "9. Security and Availability" },
  { id: "termination", title: "10. Suspension and Termination" },
  { id: "disclaimer", title: "11. Disclaimers" },
  { id: "liability", title: "12. Limitation of Liability" },
  { id: "changes", title: "13. Changes to These Terms" },
  { id: "contact", title: "14. Contact Us" },
];

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState("acceptance");

  const scrollToSection = (id: string) => {
    setActiveSection(id);

    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      {/* Header */}
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-6 flex items-center gap-3 text-sm text-white/40">
              <Link
                href="/"
                className="transition hover:text-white"
              >
                NOVA
              </Link>

              <span>/</span>

              <span className="text-white/70">Legal</span>
            </div>

            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white/50">
              Legal Agreement
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Terms of Service
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/50 sm:text-lg">
              These Terms of Service govern your access to and use of
              the NOVA platform, products, services, applications,
              artificial intelligence systems, and related technologies.
            </p>

            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/40">
              <span>Effective date: January 1, 2026</span>
              <span>Last updated: January 1, 2026</span>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                On this page
              </p>

              <nav className="max-h-[70vh] space-y-1 overflow-y-auto">
                {sections.map((section) => {
                  const isActive = activeSection === section.id;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className={[
                        "w-full rounded-lg px-3 py-2.5 text-left text-sm transition",
                        isActive
                          ? "bg-white/[0.08] text-white"
                          : "text-white/40 hover:bg-white/[0.04] hover:text-white/70",
                      ].join(" ")}
                    >
                      {section.title}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-sm font-medium">
                Questions about these terms?
              </p>

              <p className="mt-2 text-sm leading-6 text-white/40">
                Contact our legal and support team for additional
                information.
              </p>

              <a
                href="mailto:legal@nova.ai"
                className="mt-4 inline-flex text-sm font-medium text-white transition hover:text-white/70"
              >
                Contact legal →
              </a>
            </div>
          </aside>

          {/* Terms */}
          <article className="min-w-0">
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-10 lg:p-12">
              <div className="prose-custom max-w-none">
                <section id="acceptance" className="scroll-mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    1. Acceptance of Terms
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      By accessing, creating an account for, or using
                      NOVA, you agree to be bound by these Terms of
                      Service and all applicable policies referenced in
                      these Terms.
                    </p>

                    <p>
                      If you are using NOVA on behalf of an organization,
                      company, institution, or other legal entity, you
                      represent and warrant that you have the authority
                      to bind that entity to these Terms.
                    </p>

                    <p>
                      If you do not agree with these Terms, you must not
                      access or use the NOVA platform or related services.
                    </p>
                  </div>
                </section>

                <Divider />

                <section id="eligibility" className="scroll-mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    2. Eligibility and Account
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      You must provide accurate and complete information
                      when creating and maintaining your account. You are
                      responsible for maintaining the confidentiality of
                      your authentication credentials and for activities
                      performed through your account.
                    </p>

                    <p>
                      You agree to promptly notify NOVA if you believe
                      your account, credentials, or access environment
                      has been compromised.
                    </p>

                    <ul className="list-disc space-y-3 pl-6 marker:text-white/30">
                      <li>
                        Maintain accurate account information.
                      </li>
                      <li>
                        Protect passwords, access keys, and credentials.
                      </li>
                      <li>
                        Use organizational accounts only with proper
                        authorization.
                      </li>
                      <li>
                        Comply with applicable laws and regulations.
                      </li>
                    </ul>
                  </div>
                </section>

                <Divider />

                <section id="services" className="scroll-mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    3. Our Services
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      NOVA provides software, artificial intelligence,
                      collaboration, automation, knowledge management,
                      marketplace, workspace, and related digital
                      services.
                    </p>

                    <p>
                      Certain services may be offered as beta, preview,
                      experimental, enterprise, or region-specific
                      features. Availability, functionality, and
                      performance may change as the platform evolves.
                    </p>

                    <p>
                      We may modify, improve, replace, discontinue, or
                      introduce features where reasonably necessary for
                      security, reliability, legal compliance, or product
                      development.
                    </p>
                  </div>
                </section>

                <Divider />

                <section
                  id="acceptable-use"
                  className="scroll-mt-8"
                >
                  <h2 className="text-2xl font-semibold tracking-tight">
                    4. Acceptable Use
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      You may use NOVA only for lawful purposes and in
                      accordance with these Terms. You must not misuse,
                      disrupt, damage, reverse engineer, or attempt to
                      gain unauthorized access to the platform.
                    </p>

                    <p>You agree not to:</p>

                    <ul className="list-disc space-y-3 pl-6 marker:text-white/30">
                      <li>
                        Violate applicable laws, regulations, or
                        contractual obligations.
                      </li>
                      <li>
                        Interfere with platform security or infrastructure.
                      </li>
                      <li>
                        Attempt unauthorized access to accounts, systems,
                        data, or networks.
                      </li>
                      <li>
                        Use automated systems in a manner that causes
                        unreasonable load or disruption.
                      </li>
                      <li>
                        Upload malicious software, harmful code, or
                        destructive content.
                      </li>
                      <li>
                        Use the platform to infringe intellectual
                        property or privacy rights.
                      </li>
                    </ul>
                  </div>
                </section>

                <Divider />

                <section id="content" className="scroll-mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    5. User Content
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      You retain ownership of content, data, documents,
                      prompts, files, media, and other materials that you
                      submit to NOVA, subject to the rights necessary for
                      us to provide and operate the services.
                    </p>

                    <p>
                      You are responsible for ensuring that you have the
                      necessary rights, permissions, and legal basis to
                      submit and process your content through the
                      platform.
                    </p>

                    <p>
                      NOVA does not claim ownership of your original
                      content solely because you use our services.
                    </p>
                  </div>
                </section>

                <Divider />

                <section id="ai" className="scroll-mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    6. AI and Automated Services
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      Some NOVA features use artificial intelligence,
                      machine learning, automated reasoning, generative
                      systems, agents, or other computational processes.
                    </p>

                    <p>
                      AI-generated outputs may contain inaccuracies,
                      omissions, or unexpected results. You are
                      responsible for reviewing and validating important
                      outputs before relying on them for business, legal,
                      financial, technical, medical, or operational
                      decisions.
                    </p>

                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
                      <p className="font-medium text-amber-200">
                        Important notice
                      </p>

                      <p className="mt-2 text-sm leading-7 text-amber-100/60">
                        Artificial intelligence systems can generate
                        incorrect or incomplete information. Critical
                        decisions should always include appropriate human
                        review and professional judgment.
                      </p>
                    </div>
                  </div>
                </section>

                <Divider />

                <section id="billing" className="scroll-mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    7. Billing and Payments
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      Certain NOVA services require payment. Prices,
                      subscription terms, billing intervals, usage limits,
                      and applicable taxes may be presented to you before
                      completing a purchase.
                    </p>

                    <p>
                      You authorize NOVA and its authorized payment
                      providers to charge the applicable fees associated
                      with your selected plan or services.
                    </p>

                    <p>
                      Failure to make payment may result in restricted
                      access, suspension, or termination of paid services
                      in accordance with applicable agreements and law.
                    </p>
                  </div>
                </section>

                <Divider />

                <section
                  id="intellectual-property"
                  className="scroll-mt-8"
                >
                  <h2 className="text-2xl font-semibold tracking-tight">
                    8. Intellectual Property
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      NOVA, its platform, software, interfaces, systems,
                      branding, documentation, and proprietary technology
                      are protected by applicable intellectual property
                      laws.
                    </p>

                    <p>
                      Except where expressly permitted, you may not copy,
                      modify, distribute, sell, lease, sublicense, or
                      create derivative works based on protected NOVA
                      technology.
                    </p>
                  </div>
                </section>

                <Divider />

                <section id="security" className="scroll-mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    9. Security and Availability
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      We implement technical and organizational measures
                      designed to support the security and reliability of
                      our services. However, no online service can
                      guarantee absolute security or uninterrupted
                      availability.
                    </p>

                    <p>
                      Planned maintenance, emergency repairs,
                      infrastructure incidents, third-party failures, and
                      events outside our reasonable control may
                      temporarily affect service availability.
                    </p>
                  </div>
                </section>

                <Divider />

                <section id="termination" className="scroll-mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    10. Suspension and Termination
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      You may stop using NOVA at any time, subject to any
                      active subscription or contractual commitments.
                    </p>

                    <p>
                      NOVA may suspend or terminate access where
                      reasonably necessary to protect users, infrastructure,
                      intellectual property, security, legal compliance,
                      or the integrity of the platform.
                    </p>

                    <p>
                      Provisions that by their nature should survive
                      termination, including intellectual property,
                      disclaimers, limitations of liability, and certain
                      legal obligations, will continue to apply.
                    </p>
                  </div>
                </section>

                <Divider />

                <section id="disclaimer" className="scroll-mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    11. Disclaimers
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      To the maximum extent permitted by applicable law,
                      NOVA services are provided on an “as is” and “as
                      available” basis without warranties of any kind,
                      whether express, implied, or statutory.
                    </p>

                    <p>
                      We do not guarantee that the services will be
                      uninterrupted, error-free, completely secure, or
                      suitable for every particular purpose or use case.
                    </p>
                  </div>
                </section>

                <Divider />

                <section id="liability" className="scroll-mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    12. Limitation of Liability
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      To the maximum extent permitted by applicable law,
                      NOVA and its affiliates, officers, employees,
                      partners, and suppliers will not be liable for
                      indirect, incidental, special, consequential, or
                      punitive damages arising from or related to your use
                      of the services.
                    </p>

                    <p>
                      Nothing in these Terms is intended to exclude or
                      limit liability where such exclusion or limitation
                      is prohibited by applicable law.
                    </p>
                  </div>
                </section>

                <Divider />

                <section id="changes" className="scroll-mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    13. Changes to These Terms
                  </h2>

                  <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55">
                    <p>
                      We may update these Terms from time to time to
                      reflect changes in our services, technology,
                      operations, legal requirements, or business
                      practices.
                    </p>

                    <p>
                      When material changes are made, we may provide
                      notice through the platform, by email, or through
                      other appropriate communication channels.
                    </p>

                    <p>
                      Your continued use of NOVA after updated Terms
                      become effective constitutes acceptance of those
                      updated Terms where permitted by law.
                    </p>
                  </div>
                </section>

                <Divider />

                <section id="contact" className="scroll-mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    14. Contact Us
                  </h2>

                  <div className="mt-5 text-[15px] leading-8 text-white/55">
                    <p>
                      If you have questions, concerns, or requests related
                      to these Terms of Service, you may contact the NOVA
                      legal team.
                    </p>

                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6">
                      <p className="font-medium text-white">
                        NOVA Legal
                      </p>

                      <a
                        href="mailto:legal@nova.ai"
                        className="mt-3 inline-block text-white/60 transition hover:text-white"
                      >
                        legal@nova.ai
                      </a>

                      <p className="mt-3 text-sm text-white/35">
                        Please include sufficient information so we can
                        understand and respond to your request.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Footer links */}
            <div className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:flex-row sm:items-center">
              <div>
                <p className="font-medium">
                  Related legal documents
                </p>

                <p className="mt-1 text-sm text-white/40">
                  Review our privacy practices and platform policies.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/privacy"
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Privacy Policy
                </Link>

                <Link
                  href="/settings"
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Settings
                </Link>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

function Divider() {
  return <div className="my-12 h-px bg-white/10" />;
}