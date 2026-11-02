import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalPageShell,
  LegalSection,
  LegalTable,
} from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Refund Policy — Viserv',
  description:
    'When and how Viserv refunds Government Fees, Service Fees and Third-Party Charges for visa Orders.',
};

export default function RefundPolicyPage() {
  return (
    <LegalPageShell
      title="Refund Policy"
      lastUpdated="01 Nov 2026"
      relatedHref="/terms"
      relatedLabel="Terms and Conditions"
      intro={
        <>
          <p>
            We want you to know exactly where you stand before you pay. This
            Refund Policy explains when you can get your money back, how much,
            and how long it takes. It applies to every Order placed with Viserv,
            whether online at{' '}
            <a href="https://www.viserv.in">www.viserv.in</a>, through our app,
            over WhatsApp or phone, or at our office.
          </p>
          <p>
            This Policy forms part of our Terms and Conditions. Words such as
            Applicant, Authority, Order, Government Fee, Service Fee and
            Third-Party Charges have the same meanings given to them there.
          </p>
          <p>
            In short: if we have not started work, you get a full refund. Once
            your application is with the embassy or visa centre, the money has
            been spent on your behalf and cannot be returned. If we make a
            mistake, we fix it or refund it in full.
          </p>
        </>
      }
    >
      <LegalSection id="components" title="1. What makes up the amount you pay">
        <p>
          Every Order is made up of up to four parts. Each is treated differently
          for refunds, because each goes to a different place:
        </p>
        <LegalTable
          headers={['Component', 'Who receives it', 'Refund position in general']}
          rows={[
            [
              'Government Fee',
              'The embassy, consulate, immigration department or its appointed visa centre',
              'Refundable only before we pay it. Once paid, Authorities almost never return it, whatever the outcome',
            ],
            [
              'Viserv Service Fee',
              'Viserv, for our review, form-filling, submission and support',
              'Depends on how far your application has progressed (see Section 2)',
            ],
            [
              'Third-Party Charges',
              'Visa centres, couriers, translators, photographers, appointment providers and similar',
              'Refundable only if not yet incurred, or if the third party returns it to us',
            ],
            [
              'Taxes (GST)',
              'The Government of India',
              'Refunded in proportion to the part of the Service Fee that is refunded',
            ],
          ]}
        />
      </LegalSection>

      <LegalSection id="cancel" title="2. Refunds when you cancel">
        <p>
          You can cancel an Order at any time by writing to{' '}
          <a href="mailto:hello@viserv.in">hello@viserv.in</a> or through your
          account. The refund depends on the stage your Order has reached when we
          receive your cancellation request:
        </p>
        <LegalTable
          headers={[
            'Stage of your Order',
            'Government Fee',
            'Viserv Service Fee',
            'Third-Party Charges',
          ]}
          rows={[
            [
              'Stage 1: Payment received, but we have not started reviewing your documents',
              'Refunded in full',
              'Refunded in full, less payment gateway charges of up to 2% or as applicable as mode of payment.',
              'Refunded in full',
            ],
            [
              'Stage 2: Document review or form-filling has started, but the application has not been lodged',
              'Refunded, if not yet paid to the Authority',
              '50% refunded',
              'Refunded, if not yet incurred',
            ],
            [
              'Stage 3: Appointment booked, or Government Fee paid, but application not yet lodged',
              'Refunded only if the Authority returns it',
              '25% refunded',
              'Refunded only if recoverable',
            ],
            [
              'Stage 4: Application lodged with the Authority',
              'Not refunded',
              'Not refunded',
              'Not refunded',
            ],
          ]}
        />
        <p>
          We will tell you which stage your Order is at whenever you ask, and we
          will confirm it in writing when you cancel.
        </p>
      </LegalSection>

      <LegalSection id="other-situations" title="3. Refunds in other situations">
        <LegalTable
          headers={['Situation', 'What you receive']}
          rows={[
            [
              'Your visa is refused by the Authority',
              'No refund of any component, because the work has been done and the fees paid. If you bought a refund-protection add-on, its conditions apply (see Section 5)',
            ],
            [
              'The visa is granted with a shorter validity, fewer entries or a different type than you asked for',
              "No refund. This is the Authority's decision and is not a failure of our service",
            ],
            [
              'The Authority delays its decision or asks for an interview or extra documents',
              'No refund. We will continue to support you until a decision is made',
            ],
            [
              'Viserv makes an error that causes the application to be refused or returned (for example, a typing mistake in the form that was not in the information you gave us)',
              'We will re-apply at our own cost, including the Government Fee. If you prefer not to re-apply, we will refund the Service Fee in full and the Government Fee to the extent it is not recovered',
            ],
            [
              'We are unable to process the visa you ordered, or the Authority suspends the visa category before we lodge it',
              'Full refund of every amount not already paid to an Authority or third party, and any amount that is later returned to us',
            ],
            [
              'You were charged twice, or charged more than the price shown',
              'Full refund of the excess amount',
            ],
            [
              'Payment failed but money was deducted from your account',
              'Usually reversed automatically by your bank or the payment gateway within 5 to 7 working days. If not, write to us and we will follow up',
            ],
            [
              'The Government Fee falls after you have paid, before we pay it',
              'The difference is refunded to you',
            ],
            [
              'The Government Fee rises after you have paid, and you choose not to pay the difference',
              'You may cancel, and the Stage 1 or Stage 2 refund rules above will apply',
            ],
          ]}
        />
      </LegalSection>

      <LegalSection id="no-refund" title="4. When no refund is given">
        <p>
          We do not refund the Service Fee, and any Government Fee or Third-Party
          Charges already paid, in these cases:
        </p>
        <ul>
          <li>
            the application is refused, delayed or returned because of
            information or documents that you or an Applicant provided that were
            false, incomplete, forged or out of date;
          </li>
          <li>
            you did not reply to our requests for documents or approvals within
            the time we asked, and an appointment or deadline was missed as a
            result;
          </li>
          <li>
            documents remained outstanding for 60 consecutive days after our
            first written request, and we closed the Order as allowed in our
            Terms;
          </li>
          <li>
            an Applicant did not attend a biometrics appointment or interview
            required by the Authority;
          </li>
          <li>
            you changed your travel plans, dates or destination after the
            application was lodged;
          </li>
          <li>
            an Applicant was refused entry at the border despite holding a valid
            visa; or
          </li>
          <li>
            we cancelled the Order because of suspected fraud, misuse, a payment
            chargeback, or abusive behaviour towards our staff.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="add-ons" title="5. Optional add-ons">
        <p>
          <strong>5.1</strong> Viserv add-ons (for example express handling,
          document translation or photographs) are refundable in full if we have
          not started work on them, and not refundable once they have been
          delivered.
        </p>
        <p>
          <strong>5.2 Refund-protection plans.</strong> If we offer a plan that
          refunds some or all of your fees on refusal or late delivery, and you
          bought it for your Order, its benefits and conditions will be those
          shown to you at the time of purchase. The plan fee itself is not
          refundable once the application is lodged.
        </p>
        <p>
          <strong>5.3</strong> Third-party products such as travel insurance,
          forex cards, or flight and hotel reservations are refunded under the
          provider&apos;s own cancellation policy. We will help you raise the
          request, but the decision rests with the provider.
        </p>
      </LegalSection>

      <LegalSection id="group" title="6. Group and family Orders">
        <p>
          Where one Order covers several Applicants, each Applicant&apos;s
          application is treated separately. If one traveller cancels or is
          refused, the refund rules apply only to that traveller&apos;s share of
          the fees. Cancelling for one traveller does not cancel the Order for
          the others unless you ask us to.
        </p>
      </LegalSection>

      <LegalSection id="how-to-request" title="7. How to request a refund">
        <ul>
          <li>
            Write to{' '}
            <a href="mailto:hello@viserv.in">hello@viserv.in</a> from the email
            address used for the Order, or use the &quot;Cancel&quot; or
            &quot;Request refund&quot; option in your account.
          </li>
          <li>
            Include your Order number, the name of each Applicant concerned, and
            the reason for your request.
          </li>
          <li>
            If your request relates to a refusal caused by our error, attach a
            copy of the refusal letter.
          </li>
          <li>
            We will acknowledge your request within 3 working days and confirm
            our decision in writing within 7 working days, showing how the refund
            amount has been calculated.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="payment" title="8. How and when refunds are paid">
        <p>
          <strong>8.1</strong> Approved refunds are paid to the original payment
          method (card, UPI, net banking or wallet) within 7 to 10 working days
          of our decision. Depending on your bank, it may take a few more days
          for the amount to appear in your account.
        </p>
        <p>
          <strong>8.2</strong> If the original payment method is no longer
          available, or you paid by bank transfer or cash at our office, we will
          pay the refund by bank transfer to an account in the name of the person
          who paid, after verifying the account details.
        </p>
        <p>
          <strong>8.3</strong> Where a Government Fee or Third-Party Charge is
          returned to us by an Authority or a third party, we will pass it on
          within 7 working days of receiving it. Authorities can take several
          weeks or months to return fees, and we cannot control that timeline.
        </p>
        <p>
          <strong>8.4</strong> Refunds are made in Indian Rupees. Any difference
          caused by exchange rate movements or by charges levied by your bank or
          card issuer, including foreign-currency or cross-border charges, cannot
          be refunded by Viserv.
        </p>
        <p>
          <strong>8.5</strong> Refunds are not paid in cash, and cannot be
          converted to credit for a different person unless we agree in writing.
        </p>
      </LegalSection>

      <LegalSection id="credit" title="9. Credit instead of a refund">
        <p>
          If you are entitled to a refund of the Service Fee, you may instead
          choose to keep it as Viserv credit for a future application. Credit is
          valid for 12 months, can be used for any Applicant on your account, and
          does not carry interest. Choosing credit is always optional.
        </p>
      </LegalSection>

      <LegalSection id="chargebacks" title="10. Chargebacks">
        <p>
          Please contact us before raising a dispute with your bank. Most issues
          can be settled faster with us directly. If a chargeback is raised for
          an Order where work has already been carried out or fees have been paid
          to an Authority, we will share our records with your bank. We may
          suspend further work on the Order while the dispute is open.
        </p>
      </LegalSection>

      <LegalSection id="disagree" title="11. If you disagree with our decision">
        <p>
          If you are not satisfied with our refund decision, you may escalate it
          to our Grievance Officer:
        </p>
        <LegalTable
          headers={['Detail', 'Information']}
          rows={[
            ['Name', 'Harsh Darak'],
            [
              'Address',
              'Viserv, No 5/1, 1st Cross, RRMR Extn, KH Road, Bengaluru, Karnataka',
            ],
            [
              'Email',
              <a key="email" href="mailto:harsh@viserv.in">
                harsh@viserv.in
              </a>,
            ],
            ['Phone', '7019902821'],
          ]}
        />
        <p>
          We will acknowledge your complaint within 48 hours and aim to resolve
          it within one month. Nothing in this Policy affects your rights as a
          consumer under the Consumer Protection Act, 2019, including your right
          to approach the National Consumer Helpline (1915) or the appropriate
          Consumer Disputes Redressal Commission.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="12. Changes to this Policy">
        <p>
          We may update this Policy from time to time. The version in force on
          the date you placed your Order will apply to that Order. The latest
          version will always be available on our website with its &quot;Last
          updated&quot; date.
        </p>
        <p>
          How we work with you commercially is covered in our{' '}
          <Link href="/terms">Terms and Conditions</Link>. How we handle personal
          data is explained in our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
