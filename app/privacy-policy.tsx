import React from 'react';
import { Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Stack, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

// Keep in sync with public/privacy-policy.html (the public page linked in the Play listing).
const POLICY_URL = 'https://www.pantraride.space/privacy-policy.html';
const CONTACT_EMAIL = 'pylifekelvin@gmail.com';

type Block =
  | { t: 'p'; text: string }
  | { t: 'sub'; text: string }
  | { t: 'li'; text: string }
  | { t: 'link'; text: string; url: string };

type Section = { title: string; blocks: Block[] };

const p = (text: string): Block => ({ t: 'p', text });
const sub = (text: string): Block => ({ t: 'sub', text });
const li = (text: string): Block => ({ t: 'li', text });
const link = (text: string, url: string): Block => ({ t: 'link', text, url });

const SECTIONS: Section[] = [
  {
    title: 'Information Collection and Use',
    blocks: [
      p('The Application collects information when you download and use it. This information may include:'),
      sub('Collected automatically'),
      li("Your device's Internet Protocol address"),
      li('The pages of the Application that you visit, the time and date of your visit, and the time spent on those pages'),
      li('The time spent on the Application'),
      li('The mobile operating system and device model you use'),
      li('Your push notification token'),
      li('Crash and error reports'),
      sub('Information you provide'),
      li('Name, email address, phone number, date of birth and address'),
      li('Profile photo'),
      li('Messages and support requests you send through the Application'),
      sub('Drivers also provide'),
      li("Driver's licence and other verification documents, and a selfie"),
      li('Vehicle details'),
      li('Bank account details, used to pay out earnings'),
      sub('Payments'),
      p('When you make a payment, your credit or debit card details are collected directly by our third-party payment processor, Flutterwave, through its secure, hosted checkout. Our servers do not receive, store or process your full card numbers. We only retain transaction reference IDs and truncated card details provided by Flutterwave (such as the card type, last 4 digits and expiry date) to verify payments and manage your billing history. The Application also keeps a record of wallet balances, payments, refunds and fares.'),
      sub('Trip information'),
      p('Pickup and drop-off locations, routes, fares and trip history.'),
      p('The information the Service Provider requests will be retained and used as described in this privacy policy.'),
    ],
  },
  {
    title: 'Cookies and tracking technologies',
    blocks: [
      p('The Application or its third-party SDKs may use cookies, SDKs, pixels, and similar technologies to support functionality, analytics, or service delivery. Where required by applicable law, the Service Provider will obtain consent before using non-essential tracking technologies.'),
    ],
  },
  {
    title: 'Location Information',
    blocks: [
      p("The Application collects your device's precise location to provide location-based features, improve the Application, and support related services. Drivers' location is collected while they are online or on a trip and the Application is open, so that riders can see the driver's position and trips can be completed. The Application does not request access to your location in the background."),
      li('Geolocation Services: The Service Provider uses location data to provide location-based features, such as matching, navigation and fares.'),
      li('Analytics and Improvements: Aggregated location data may help the Service Provider understand usage patterns and improve performance.'),
      li('Third-Party Services: Location data may be shared with third-party services used to support Application functionality, subject to this privacy policy and applicable law.'),
      p('You can turn location off in your device settings, but trip features will not work without it.'),
    ],
  },
  {
    title: 'Sharing between riders and drivers',
    blocks: [
      p('Once a trip is accepted, limited information is shared between the rider and the driver to support a safe and successful pickup.'),
      li('What drivers see about riders: first name, pickup location, drop-off location and live location.'),
      li('What riders see about drivers: name, vehicle make, model and colour, licence plate number and live GPS location.'),
      li("Calls and messages: riders and drivers can message each other in the Application and can call each other from it to coordinate the trip. A call uses the other person's phone number."),
    ],
  },
  {
    title: 'Advertising',
    blocks: [
      p("The Application shows ads through Google AdMob, which may use your device's advertising ID. You can turn personalised ads off in the Application's Privacy settings and in your device settings. On iOS, the Application asks for your permission before tracking."),
    ],
  },
  {
    title: 'Your Rights',
    blocks: [
      p(`You may request access to, correction of, or deletion of your personal data held by the Service Provider. You can delete your account and download a copy of your data in the Application, under Privacy. To exercise these rights, or to withdraw consent where processing is based on consent, you can also contact the Service Provider at ${CONTACT_EMAIL}.`),
    ],
  },
  {
    title: 'Your Rights Under NDPR',
    blocks: [
      p('The Service Provider processes personal data in line with the Nigeria Data Protection Regulation (NDPR). Under the NDPR, you have the right to:'),
      li('Access your personal data'),
      li('Correct inaccurate or incomplete information'),
      li('Request deletion of your data (subject to legal requirements)'),
      li('Object to processing of your data'),
      li('Withdraw consent at any time'),
      li('Lodge a complaint with the Nigeria Data Protection Commission (NDPC)'),
      p(`To exercise these rights, contact the Service Provider at ${CONTACT_EMAIL}.`),
    ],
  },
  {
    title: 'Your California privacy rights (CCPA/CPRA)',
    blocks: [
      p(`If you are a California resident, you have the right to know what personal information is collected, the right to delete personal information, the right to opt out of the sale or sharing of personal information, and the right to non-discrimination for exercising these rights. To exercise your CCPA/CPRA rights, contact the Service Provider at ${CONTACT_EMAIL}.`),
      p('We do not sell your personal data for monetary compensation. However, we use Google AdMob to display personalized advertisements within the Application, which may be considered "sharing" your device identifiers for cross-context behavioral advertising under California law.'),
      p('Your right to opt out: If you are a California resident, you have the right to opt out of this sharing. You can do this at any time in the Application\'s Privacy settings by turning off "Personalized Ads". Once turned off, you will still see ads, but they will not be tailored to your interests.'),
      p('The Service Provider may use the information you provide to send important information, required notices, and, where permitted by law, marketing communications.'),
    ],
  },
  {
    title: 'Third Party Access',
    blocks: [
      p('The Service Provider shares personal information with the service providers listed below, only as needed to run the Application. Aggregated, anonymized data may also be used to improve the Application. The Service Provider may share your information with third parties in the ways that are described in this privacy statement.'),
      p('The Application uses third-party services that have their own privacy policies about handling data:'),
      link('Supabase (database, authentication, file storage)', 'https://supabase.com/privacy'),
      link('Google (Sign-In, Maps, AdMob advertising)', 'https://policies.google.com/privacy'),
      link('Flutterwave (payments and payouts)', 'https://flutterwave.com/us/privacy-policy'),
      link('Expo (push notifications)', 'https://expo.dev/privacy'),
      link('Sentry (crash reporting)', 'https://sentry.io/privacy/'),
      link('Open-Meteo (weather)', 'https://open-meteo.com/en/terms'),
      p('The Service Provider may disclose User Provided and Automatically Collected Information:'),
      li('as required by law, such as to comply with a subpoena, or similar legal process;'),
      li('when they believe in good faith that disclosure is necessary to protect their rights, protect your safety or the safety of others, investigate fraud, or respond to a government request;'),
      li('with their trusted service providers who work on their behalf, do not have an independent use of the information the Service Provider discloses to them, and have agreed to adhere to the rules set forth in this privacy statement.'),
    ],
  },
  {
    title: 'International Data Transfers',
    blocks: [
      p('The Service Provider or its third-party service providers may transfer personal data to countries outside your country of residence, including outside the European Economic Area (EEA). Where applicable law requires safeguards for international transfers, the Service Provider will use appropriate mechanisms:'),
      li('Standard Contractual Clauses (SCCs) approved by the European Commission'),
      li('Adequacy decisions or other legally recognized transfer mechanisms'),
      li('Your consent, where required and legally permitted'),
      p('Data protection laws in other countries may differ from those in your jurisdiction. Where required by law, the Service Provider will apply appropriate safeguards and obtain any consent required for the transfer.'),
    ],
  },
  {
    title: 'Opt-Out Rights',
    blocks: [
      p('You can stop further collection of information from your mobile device by uninstalling the Application. Uninstalling will stop the Application from collecting data from your device, but it does not automatically delete information that has already been transmitted to the Service Provider or to third parties.'),
      p(`To delete your account and personal data, use the Delete My Account option in the Application under Privacy, or email the Service Provider at ${CONTACT_EMAIL}. Full instructions are at https://www.pantraride.space/delete-account.html. To protect your security, we will verify your identity before processing a request, which may require you to confirm it from the email address or phone number linked to your account. We will acknowledge your request within 48 hours and fully process the deletion within 30 days, subject to any data we are legally required to retain for tax, fraud prevention, or regulatory purposes. When you delete your account, your personal details are removed or anonymised. Payment, wallet, refund and fare records are kept as long as the law and the Service Provider's accounting obligations require.`),
    ],
  },
  {
    title: 'Data Retention Policy',
    blocks: [
      p('The Service Provider retains personal data based on its necessity for the stated purposes:'),
      li('Account and user provided data: kept while your account is active. When you delete your account, personal details are removed or anonymised.'),
      li('Payment, wallet, refund and fare records: kept as long as required by applicable law and accounting obligations.'),
      li('Aggregated and anonymized data: retained indefinitely, as it no longer identifies you.'),
      li('Data required for legal compliance: retained as long as required by applicable law.'),
      p('You may request deletion of your personal data, subject to any legal obligation to retain it. Please note that some User Provided Data may be required for the Application to function properly.'),
    ],
  },
  {
    title: 'Children',
    blocks: [
      p('The Application is not intended for children under 18 years of age, or such higher age as required by applicable law. The Service Provider does not knowingly solicit data from children or market the Application to them.'),
      p(`Where parental or guardian consent is required under applicable law, the Application is not intended for use without that consent. The Service Provider does not knowingly collect personally identifiable information from children under 18 years of age in violation of applicable law. In the event the Service Provider discovers that a child has provided personal information, the Service Provider will immediately delete this from their servers. If you are a parent or guardian and you are aware that your child has provided the Service Provider with personal information, please contact the Service Provider (${CONTACT_EMAIL}) so that they will be able to take the necessary actions.`),
    ],
  },
  {
    title: 'Security',
    blocks: [
      p('The Service Provider is concerned about safeguarding the confidentiality of your information. The Service Provider provides physical, electronic, and procedural safeguards to protect information the Service Provider processes and maintains.'),
    ],
  },
  {
    title: 'Data Breach Notification',
    blocks: [
      p('If a data breach occurs that affects your personal data, the Service Provider will notify you in accordance with applicable legal requirements, including, where required, providing information about the nature of the breach and the steps being taken to address it.'),
    ],
  },
  {
    title: 'Changes',
    blocks: [
      p('The Service Provider may update this Privacy Policy from time to time. The Service Provider will notify you of material changes by posting the updated Privacy Policy with an effective date. Where required by law, the Service Provider will seek your consent to material changes before they take effect.'),
      p(`Previous versions of this Privacy Policy will be maintained and made available upon request by contacting the Service Provider at ${CONTACT_EMAIL}.`),
      p('This privacy policy is effective as of 2026-10-29.'),
    ],
  },
  {
    title: 'Your Consent',
    blocks: [
      p('Where processing is based on consent, you provide that consent by affirmatively opting in to the relevant feature or action. You may withdraw consent at any time without affecting processing carried out before withdrawal. Processing based on other lawful bases is carried out as described above.'),
    ],
  },
  {
    title: 'Contact Us',
    blocks: [
      p(`If you have any questions regarding privacy while using the Application, or have questions about the practices, please contact the Service Provider via email at ${CONTACT_EMAIL}.`),
      p('Pantra Dev, House 5B, Mad Badaamosi Street, Jikwoyi, Abuja 900001, Nigeria.'),
    ],
  },
];

export default function PrivacyPolicy() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Privacy Policy',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color="#000" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>PRIVACY POLICY</Text>
        <Text style={styles.effectiveDate}>Effective as of 2026-10-29</Text>

        <Text style={styles.paragraph}>
          This privacy policy applies to the Pantra app for mobile devices, together with any related services operated by
          Pantra Dev (collectively, the &quot;Application&quot;). Pantra Dev is hereby referred to as the &quot;Service Provider&quot;.
        </Text>

        {SECTIONS.map((section) => (
          <React.Fragment key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.blocks.map((block, i) => {
              switch (block.t) {
                case 'sub':
                  return <Text key={i} style={styles.subSectionTitle}>{block.text}</Text>;
                case 'li':
                  return <Text key={i} style={styles.bulletPoint}>• {block.text}</Text>;
                case 'link':
                  return (
                    <Text key={i} style={styles.bulletPoint}>
                      •{' '}
                      <Text style={styles.link} onPress={() => Linking.openURL(block.url)}>
                        {block.text}
                      </Text>
                    </Text>
                  );
                default:
                  return <Text key={i} style={styles.paragraph}>{block.text}</Text>;
              }
            })}
          </React.Fragment>
        ))}

        <Text style={styles.sectionTitle}>Read online</Text>
        <Text style={styles.link} onPress={() => Linking.openURL(POLICY_URL)}>
          {POLICY_URL}
        </Text>

        <Text style={styles.footer} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  effectiveDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
    marginTop: 24,
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    marginBottom: 8,
    paddingLeft: 8,
  },
  link: {
    fontSize: 14,
    lineHeight: 22,
    color: '#0b5fff',
    textDecorationLine: 'underline' as const,
  },
  footer: {
    height: 20,
  },
});
