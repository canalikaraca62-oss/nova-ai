import Link from "next/link";

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>

          <p className="mt-5 text-sm text-zinc-500">
            Last updated: August 21, 2026
          </p>
        </div>

        {/* Content */}
        <div className="space-y-12 py-12 text-zinc-400">
          <section>
            <h2 className="text-2xl font-semibold text-white">
              1. Introduction
            </h2>

            <p className="mt-4 leading-8">
              QELVORA respects your privacy. This Privacy Policy explains
              how we collect, use, and protect information when you use
              the QELVORA platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              2. Information We Collect
            </h2>

            <p className="mt-4 leading-8">
              We may collect information you provide directly when using
              QELVORA, including account information, conversations,
              uploaded files, and information you choose to save or share
              through the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              3. How We Use Information
            </h2>

            <p className="mt-4 leading-8">
              Information is used to provide and improve QELVORA, operate
              your account, process conversations and files, maintain
              relevant context, and improve the functionality and security
              of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              4. Conversations and AI Processing
            </h2>

            <p className="mt-4 leading-8">
              Messages and content submitted to QELVORA may be processed
              by artificial intelligence services in order to generate
              responses and provide requested functionality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              5. Files and Documents
            </h2>

            <p className="mt-4 leading-8">
              Files uploaded to QELVORA may be stored and processed in
              order to provide document analysis and other requested
              features. Please avoid uploading sensitive information unless
              necessary.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              6. Memory
            </h2>

            <p className="mt-4 leading-8">
              QELVORA may store information that you choose to save or that
              is used to provide persistent context and personalized
              experiences. You may be able to manage or remove saved
              information through the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              7. Data Security
            </h2>

            <p className="mt-4 leading-8">
              We take reasonable measures to protect information stored
              within QELVORA. However, no method of transmission or storage
              can be guaranteed to be completely secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              8. Third-Party Services
            </h2>

            <p className="mt-4 leading-8">
              QELVORA may rely on third-party infrastructure, authentication,
              storage, hosting, and artificial intelligence providers to
              operate the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              9. Changes to This Policy
            </h2>

            <p className="mt-4 leading-8">
              This Privacy Policy may be updated from time to time. Any
              changes will be reflected on this page together with an updated
              revision date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              10. Contact
            </h2>

            <p className="mt-4 leading-8">
              If you have questions about this Privacy Policy, please contact
              us at{" "}
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