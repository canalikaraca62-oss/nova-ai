import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-24 text-white sm:px-6 sm:py-32">
      <div className="mx-auto w-full max-w-3xl">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center text-sm text-zinc-500 transition hover:text-white"
        >
          ← Back to QELVORA
        </Link>

        {/* Header */}
        <div className="mt-12 border-b border-white/10 pb-12">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-600">
            Legal
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Terms of Service
          </h1>

          <p className="mt-5 text-sm text-zinc-500">
            Last updated: August 21, 2026
          </p>
        </div>

        {/* Content */}
        <div className="space-y-12 py-12 text-zinc-400">
          <section>
            <h2 className="text-2xl font-semibold text-white">
              1. Acceptance of Terms
            </h2>

            <p className="mt-4 leading-8">
              By accessing or using QELVORA, you agree to these Terms of
              Service. If you do not agree with these terms, you should not
              use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              2. Use of the Service
            </h2>

            <p className="mt-4 leading-8">
              QELVORA provides artificial intelligence tools, conversations,
              document processing, memory, and related features. You agree
              to use the platform responsibly and in accordance with
              applicable laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              3. Your Account
            </h2>

            <p className="mt-4 leading-8">
              You are responsible for maintaining the security of your
              account and for activity that occurs under your account.
              Please provide accurate information and keep your login
              credentials secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              4. AI-Generated Content
            </h2>

            <p className="mt-4 leading-8">
              QELVORA uses artificial intelligence to generate responses and
              other content. AI-generated content may be inaccurate,
              incomplete, or unsuitable for your specific situation. You are
              responsible for reviewing and evaluating generated content
              before relying on it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              5. Uploaded Content
            </h2>

            <p className="mt-4 leading-8">
              You are responsible for files, documents, messages, and other
              content that you upload or submit to QELVORA. You should only
              upload content that you have the right to use and share.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              6. Prohibited Use
            </h2>

            <p className="mt-4 leading-8">
              You may not use QELVORA for unlawful, harmful, fraudulent, or
              abusive purposes, or attempt to interfere with the security,
              availability, or proper operation of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              7. Service Availability
            </h2>

            <p className="mt-4 leading-8">
              We aim to provide a reliable service, but QELVORA may
              occasionally be unavailable due to maintenance, technical
              issues, updates, or circumstances outside our control.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              8. Changes to the Service
            </h2>

            <p className="mt-4 leading-8">
              QELVORA may modify, improve, suspend, or discontinue parts of
              the platform at any time as the product continues to evolve.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              9. Limitation of Liability
            </h2>

            <p className="mt-4 leading-8">
              To the extent permitted by applicable law, QELVORA is provided
              on an “as is” and “as available” basis. We do not guarantee
              that the service will always be uninterrupted, error-free, or
              suitable for every purpose.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              10. Changes to These Terms
            </h2>

            <p className="mt-4 leading-8">
              These Terms of Service may be updated from time to time.
              Updates will be published on this page together with a revised
              date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              11. Contact
            </h2>

            <p className="mt-4 leading-8">
              If you have questions about these Terms of Service, please
              contact us at{" "}
              <a
                href="mailto:support@qelvora.com"
                className="text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
              >
                support@qelvora.com
              </a>
              .
            </p>
          </section>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/10 py-8">
          <p className="text-sm text-zinc-600">
            © {new Date().getFullYear()} QELVORA. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}