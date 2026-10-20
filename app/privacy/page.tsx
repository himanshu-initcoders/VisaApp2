import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalPageShell,
  LegalSection,
  LegalTable,
} from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Privacy Policy — Viserv',
  description:
    'How Viserv collects, uses, shares and protects personal data under the Digital Personal Data Protection Act, 2023.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      lastUpdated="October 2026"
      relatedHref="/terms"
      relatedLabel="Terms and Conditions"
      intro={
        <>
          <p>
            Applying for a visa means trusting someone with your passport, your
            photographs, your bank statements and details of your family and
            travel plans. At Viserv, we treat that information with the same care
            we would want for our own.
          </p>
          <p>
            This Privacy Policy explains what personal data Viserv collects, why
            we need it, who we share it with, how long we keep it, and the
            choices and rights available to you. It applies to everyone who uses{' '}
            <a href="https://www.viserv.in">www.viserv.in</a>, any Viserv mobile
            application, or who contacts us by WhatsApp, email, phone or in
            person (together, the &quot;Platform&quot;).
          </p>
          <p>
            Viserv with its registered office at No 5/1, 1st Cross, RRMR Extn, KH
            Road, Bengaluru, Karnataka, India (&quot;Viserv&quot;, &quot;we&quot;,
            &quot;us&quot; or &quot;our&quot;). For the purposes of the Digital
            Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;), we are the
            Data Fiduciary for the personal data described in this Policy, and
            you are the Data Principal.
          </p>
          <p>
            This Policy has been prepared in line with the DPDP Act, the Digital
            Personal Data Protection Rules, 2025, the Information Technology Act,
            2000 and the rules made under it. It should be read together with our
            Terms and Conditions.
          </p>
        </>
      }
    >
      <LegalSection id="key-terms" title="1. Key terms used in this Policy">
        <ul>
          <li>
            <strong>Personal data</strong> means any information about an
            individual who can be identified from that information, either on its
            own or together with other information.
          </li>
          <li>
            <strong>Processing</strong> means anything done with personal data,
            including collecting, recording, storing, using, sharing,
            transferring and deleting it.
          </li>
          <li>
            <strong>Authority</strong> means any government, embassy, high
            commission, consulate, immigration department, or visa application
            centre or other service provider appointed by such a body.
          </li>
          <li>
            <strong>Applicant</strong> means each person for whom a visa or
            travel authorisation is sought through Viserv.
          </li>
          <li>
            <strong>Service provider</strong> means a company we engage to
            process personal data on our behalf, such as a cloud hosting,
            payment, messaging or courier company.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="data-we-collect" title="2. Personal data we collect">
        <p>
          What we collect depends on the destination and visa type, since each
          Authority sets its own requirements. We ask only for what is needed to
          prepare and lodge the application you have requested, or to run the
          Platform.
        </p>
        <LegalTable
          headers={['Category', 'Examples', 'Why we need it']}
          rows={[
            [
              'Identity and contact details',
              'Full name, date and place of birth, gender, nationality, address, mobile number, email address',
              'To create your account, identify each Applicant, and keep you updated',
            ],
            [
              'Travel document details',
              'Passport number, issue and expiry dates, passport scans, previous passports, national identity documents where an Authority requires them',
              'Authorities require these to assess and issue a visa',
            ],
            [
              'Visa application information',
              'Purpose and dates of travel, itinerary, accommodation, travel history, previous visas and refusals, employer or school details, family and sponsor details, invitation letters',
              'To complete the application form and supporting documents accurately',
            ],
            [
              'Financial standing documents',
              'Bank statements, income tax returns, salary slips, sponsorship letters, PAN where required for related services',
              'Many Authorities ask for proof that the Applicant can fund the trip',
            ],
            [
              'Photographs and biometric-related data',
              'Passport-style photographs and selfies uploaded for photo checks; appointment details for fingerprint or facial capture',
              'To meet photo specifications and book biometric appointments. Fingerprints are normally captured directly by the Authority or its visa centre, not by Viserv',
            ],
            [
              'Health information (only where required)',
              'Medical examination results, vaccination certificates, insurance details',
              'Some destinations require these as a condition of the visa',
            ],
            [
              'Payment and transaction details',
              'Order history, amounts paid, payment reference, GSTIN, billing name',
              'To process payments, issue invoices and handle refunds. Card details are handled by our payment gateway, not stored by us',
            ],
            [
              'Communications',
              'Messages, emails, call notes and call recordings (where we tell you a call is recorded), feedback and reviews',
              'To support you, keep a record of instructions and improve our service',
            ],
            [
              'Technical and usage data',
              'IP address, device and browser type, pages viewed, app crash logs, approximate location derived from IP, cookie identifiers',
              'To keep the Platform secure, fix problems and understand how it is used',
            ],
          ]}
        />
        <h3>Information about other people</h3>
        <p>
          If you give us personal data about another person, such as a spouse,
          child, parent, colleague or sponsor, you confirm that you have their
          permission (or, for a child, that you are their parent or lawful
          guardian) and that you have told them how we will use it in line with
          this Policy.
        </p>
        <h3>If you choose not to share information</h3>
        <p>
          You may decline to give us any information. However, if an Authority
          requires it, we will be unable to prepare or lodge the application
          without it.
        </p>
      </LegalSection>

      <LegalSection id="how-we-collect" title="3. How we collect personal data">
        <ul>
          <li>
            Directly from you, when you fill in forms, upload documents, chat
            with us, call us or visit our office.
          </li>
          <li>
            From people acting for you, such as a family member, travel agent or
            employer who places an Order on your behalf.
          </li>
          <li>
            From Authorities and visa centres, when they send us appointment
            confirmations, application status updates, requests for further
            documents, or decisions.
          </li>
          <li>
            Automatically, through cookies and similar technologies when you use
            the Platform (see Section 13).
          </li>
          <li>
            From partners, such as a referral partner or corporate client who
            introduces you to us, and from sign-in services (for example Google)
            if you choose to use them.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="how-we-use" title="4. How we use personal data, and on what basis">
        <p>
          We process personal data only for clear, lawful purposes. Under the
          DPDP Act, we rely on your consent, or on a legitimate use permitted by
          Section 7 of the Act (for example, where you have voluntarily given us
          data for a specific purpose, or where processing is needed to meet a
          legal obligation).
        </p>
        <LegalTable
          headers={['Purpose', 'Basis']}
          rows={[
            [
              'Preparing, checking and lodging your visa application, booking appointments, paying Government Fees and tracking progress',
              'Consent, and data you have voluntarily provided for this purpose',
            ],
            [
              'Creating and managing your account and verifying your identity',
              'Consent',
            ],
            [
              'Sending you service messages about your Order (status, document requests, appointment reminders)',
              'Consent, and data provided for this purpose',
            ],
            [
              'Processing payments, issuing invoices and refunds, and keeping accounting records',
              'Consent and legal obligation (tax and accounting laws)',
            ],
            [
              'Responding to your questions and complaints',
              'Consent, and data provided for this purpose',
            ],
            [
              'Preventing fraud, misuse and document forgery, and keeping the Platform secure',
              'Legal obligation and permitted legitimate uses',
            ],
            [
              'Complying with court orders and lawful requests from government agencies',
              'Legal obligation',
            ],
            [
              'Improving the Platform and our services using aggregated or de-identified data',
              'Consent (through cookie preferences where applicable)',
            ],
            [
              'Sending offers, travel tips and news about Viserv',
              'Consent, which you may withdraw at any time',
            ],
          ]}
        />
        <p>
          We do not use the documents you upload for your visa application for
          any unrelated purpose, and we do not sell personal data to anyone.
        </p>
      </LegalSection>

      <LegalSection id="consent" title="5. Your consent and how to withdraw it">
        <p>
          <strong>5.1</strong> Before we collect personal data for a purpose that
          relies on consent, we will show you a clear notice describing what we
          will collect and why, and ask for your agreement.
        </p>
        <p>
          <strong>5.2</strong> You may withdraw your consent at any time by
          writing to{' '}
          <a href="mailto:hello@viserv.in">hello@viserv.in</a>, by using the
          settings in your account, or through a Consent Manager registered with
          the Data Protection Board of India, where one is available. Withdrawing
          consent is as easy as giving it.
        </p>
        <p>
          <strong>5.3</strong> Withdrawal does not affect processing that took
          place before it. If you withdraw consent while an application is in
          progress, we may be unable to continue with it, and the refund rules in
          our Terms and Conditions will apply.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="6. Who we share personal data with">
        <p>
          We share personal data only where needed for the purposes set out
          above, and only with:
        </p>
        <ul>
          <li>
            <strong>Authorities</strong>, including embassies, consulates,
            immigration departments and their appointed visa application centres,
            to lodge and progress your application. Once an Authority receives
            your data, it processes it under its own laws and policies, which
            Viserv does not control.
          </li>
          <li>
            <strong>Service providers</strong> who help us operate, including
            cloud hosting and storage, payment gateways, SMS, email and WhatsApp
            messaging services, customer support tools, analytics providers and
            courier companies. They may use your data only to provide services to
            us and must protect it under written agreements.
          </li>
          <li>
            <strong>Professional advisers</strong>, such as lawyers, auditors and
            accountants, under a duty of confidentiality.
          </li>
          <li>
            <strong>Law enforcement, courts and regulators</strong>, when we are
            legally required to disclose data, or when disclosure is necessary to
            prevent fraud, protect someone&apos;s safety, or protect our legal
            rights.
          </li>
          <li>
            <strong>A successor business</strong>, if Viserv or its business is
            merged, acquired or restructured. The successor will be bound to use
            your data in line with this Policy.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="transfers" title="7. Transfers outside India">
        <p>
          <strong>7.1</strong> By its nature, a visa application usually involves
          sending personal data to the Authority of another country, or to a visa
          centre acting for it, which may be located outside India. Some of our
          service providers may also store data on servers outside India.
        </p>
        <p>
          <strong>7.2</strong> We transfer personal data outside India only as
          permitted by the DPDP Act, and not to any country or territory that the
          Government of India has restricted by notification. Where we use
          service providers abroad, we require them to apply security safeguards
          at least as protective as those described in this Policy.
        </p>
      </LegalSection>

      <LegalSection id="protection" title="8. How we protect personal data">
        <p>
          We use reasonable security safeguards, appropriate to the sensitivity
          of travel and identity documents, including:
        </p>
        <ul>
          <li>
            encryption of data in transit (HTTPS/TLS) and at rest on our storage
            systems;
          </li>
          <li>
            role-based access, so that only staff working on your Order can see
            your documents;
          </li>
          <li>
            multi-factor authentication for staff systems and logging of access
            to personal data;
          </li>
          <li>
            secure handling and locked storage of physical passports and
            documents in our office;
          </li>
          <li>
            confidentiality obligations in employment contracts and periodic
            privacy and security training for staff; and
          </li>
          <li>written data protection obligations for service providers.</li>
        </ul>
        <p>
          No system can be completely secure. If a personal data breach occurs,
          we will inform affected users without delay, explaining what happened,
          the likely consequences, and the steps being taken, and we will report
          it to the Data Protection Board of India as required by law.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="9. How long we keep personal data">
        <p>
          We keep personal data only for as long as it is needed for the purpose
          for which it was collected, or as required by law. As a guide:
        </p>
        <LegalTable
          headers={['Type of data', 'Retention period']}
          rows={[
            [
              'Application documents and scans (passport copies, photographs, bank statements and similar)',
              '90 days after the final outcome of the application, unless you ask us to keep them longer for a future application',
            ],
            [
              'Account and contact details',
              'While your account is active, and for 5 years after your last activity',
            ],
            [
              'Invoices, payment records and records required under tax law',
              'At least 8 years, as required by the Companies Act, 2013 and GST law',
            ],
            [
              'Communications and complaint records',
              '3 years from the date of the last communication',
            ],
            [
              'Technical logs',
              'Up to 1 year, unless needed to investigate a security incident',
            ],
          ]}
        />
        <p>
          At the end of the relevant period, data is deleted or anonymised so
          that it can no longer identify you. Data that must be kept longer to
          meet a legal obligation or to establish or defend a legal claim will be
          kept only for that purpose.
        </p>
      </LegalSection>

      <LegalSection id="your-rights" title="10. Your rights">
        <p>Under the DPDP Act, you have the right to:</p>
        <ul>
          <li>
            Access a summary of the personal data we hold about you, the
            processing we carry out, and the identities of those we have shared
            it with;
          </li>
          <li>
            Correct, complete or update inaccurate or incomplete personal data;
          </li>
          <li>
            Erase personal data that is no longer needed, unless we are required
            by law to keep it;
          </li>
          <li>Withdraw consent at any time, as described in Section 5;</li>
          <li>
            Raise a grievance with us, and escalate it to the Data Protection
            Board of India if you are not satisfied with our response; and
          </li>
          <li>
            Nominate another person to exercise these rights on your behalf in
            the event of your death or incapacity.
          </li>
        </ul>
        <p>
          To exercise any of these rights, write to{' '}
          <a href="mailto:hello@viserv.in">hello@viserv.in</a> from your
          registered email address. We may need to verify your identity before
          acting on a request. We do not charge for reasonable requests.
        </p>
        <h3>Your duties</h3>
        <p>
          The DPDP Act also asks Data Principals to provide authentic
          information, not to impersonate anyone, not to suppress material
          information, and not to file false or frivolous complaints. These
          duties apply especially to visa applications, where accuracy matters.
        </p>
      </LegalSection>

      <LegalSection id="children" title="11. Children">
        <p>
          <strong>11.1</strong> The Platform is intended for adults. Accounts may
          only be opened by people aged 18 or above.
        </p>
        <p>
          <strong>11.2</strong> Families often need visas for children. We
          process a child&apos;s personal data only when a parent or lawful
          guardian places the Order and gives verifiable consent on the
          child&apos;s behalf.
        </p>
        <p>
          <strong>11.3</strong> We do not track or monitor the behaviour of
          children, and we do not use their data for targeted advertising. If we
          learn that we hold a child&apos;s data without proper consent, we will
          delete it promptly.
        </p>
      </LegalSection>

      <LegalSection id="marketing" title="12. Marketing messages">
        <p>
          With your consent, we may send you travel updates, offers and news
          about Viserv by email, SMS or WhatsApp. You can stop these at any time
          by using the unsubscribe link, replying STOP, or writing to us. We
          respect the Do Not Disturb preferences you have registered under TRAI
          regulations. Service messages about an active Order are not marketing
          and will continue until the Order is complete.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="13. Cookies and similar technologies">
        <p>
          Cookies are small files placed on your device when you visit a website.
          We use the following types:
        </p>
        <LegalTable
          headers={['Type', 'What it does', 'Can you turn it off?']}
          rows={[
            [
              'Essential',
              'Keeps you signed in, remembers items in your application, and protects against fraud',
              'No, because the Platform will not work without them',
            ],
            [
              'Functional',
              'Remembers preferences such as language and nationality selection',
              'Yes',
            ],
            [
              'Analytics',
              'Helps us understand which pages are used and where people have difficulty, using tools such as Google Analytics',
              'Yes',
            ],
            [
              'Marketing',
              'Measures the effect of our advertising, using tools such as Meta Pixel / Google Ads',
              'Yes',
            ],
          ]}
        />
        <p>
          You can manage non-essential cookies through the cookie banner on our
          website or your browser settings. Mobile app permissions, such as
          camera access for photographing documents, can be changed in your
          device settings at any time.
        </p>
      </LegalSection>

      <LegalSection id="links" title="14. Links to other websites">
        <p>
          The Platform links to official government portals and other third-party
          websites. Their privacy practices are their own, and we encourage you
          to read their policies before sharing information with them.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="15. Changes to this Policy">
        <p>
          We will update this Policy when our practices or the law change. The
          latest version will always be available on this page with its
          &quot;Last updated&quot; date. If we make a significant change, we will
          notify registered users by email or through the Platform before it
          takes effect, and where the change requires fresh consent, we will ask
          for it.
        </p>
      </LegalSection>

      <LegalSection id="grievance" title="16. Grievance Officer and contact details">
        <p>
          For any question, request or complaint about how we handle personal
          data, please contact:
        </p>
        <LegalTable
          headers={['Detail', 'Information']}
          rows={[
            ['Grievance Officer', 'Harsh Darak'],
            [
              'Address',
              'No 5/1, 1st Cross, RRMR Extn, KH Road, Bengaluru, India',
            ],
            [
              'Email',
              <a key="email" href="mailto:harsh@viserv.in">
                harsh@viserv.in
              </a>,
            ],
            [
              'Phone',
              '7019902821 (10am to 8pm, Monday to Saturday)',
            ],
          ]}
        />
        <p>
          Please include your name, registered mobile number or email, your Order
          number (if any), and a clear description of your concern. We will
          acknowledge your complaint within 48 hours and respond within 30 days,
          or sooner where the law requires.
        </p>
        <p>
          If you are not satisfied with our response, you may escalate your
          complaint to the Data Protection Board of India in the manner
          prescribed under the DPDP Act and its Rules.
        </p>
        <p>
          How we work with you commercially is covered in our{' '}
          <Link href="/terms">Terms and Conditions</Link>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
