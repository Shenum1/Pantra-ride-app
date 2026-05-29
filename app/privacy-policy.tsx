import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

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
        
        <Text style={styles.effectiveDate}>Effective Date: January 1, 2025</Text>
        <Text style={styles.effectiveDate}>Last Updated: January 1, 2025</Text>
        
        <Text style={styles.paragraph}>
          Pantra Limited (&quot;Pantra&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. 
          This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Pantra App 
          and related services (collectively, the &quot;Services&quot;).
        </Text>
        
        <Text style={styles.paragraph}>
          By using the Pantra App, you consent to the data practices described in this policy. This Privacy Policy complies with 
          the Nigeria Data Protection Regulation (NDPR) and other applicable data protection laws.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        
        <Text style={styles.subSectionTitle}>1.1 Personal Information</Text>
        <Text style={styles.paragraph}>When you register for an account, we collect:</Text>
        <Text style={styles.bulletPoint}>• Full name</Text>
        <Text style={styles.bulletPoint}>• Email address</Text>
        <Text style={styles.bulletPoint}>• Phone number</Text>
        <Text style={styles.bulletPoint}>• Profile photo (optional)</Text>
        <Text style={styles.bulletPoint}>• Date of birth</Text>
        <Text style={styles.bulletPoint}>• Government-issued ID (for driver verification)</Text>

        <Text style={styles.subSectionTitle}>1.2 Location Data</Text>
        <Text style={styles.paragraph}>
          We collect real-time location data to provide ride-matching services, calculate fares, and improve safety. 
          Location data is collected when the app is in use and, for drivers, when actively providing services.
        </Text>

        <Text style={styles.subSectionTitle}>1.3 Payment Information</Text>
        <Text style={styles.paragraph}>
          Payment details are processed through secure third-party providers (Paystack, Chipper Cash, PalmPay). 
          We do not store full credit card numbers on our servers.
        </Text>

        <Text style={styles.subSectionTitle}>1.4 Usage Data</Text>
        <Text style={styles.paragraph}>We automatically collect:</Text>
        <Text style={styles.bulletPoint}>• Device information (model, operating system, unique identifiers)</Text>
        <Text style={styles.bulletPoint}>• App usage patterns and preferences</Text>
        <Text style={styles.bulletPoint}>• Ride history and transaction records</Text>
        <Text style={styles.bulletPoint}>• Communication between riders and drivers</Text>

        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.paragraph}>We use collected information to:</Text>
        <Text style={styles.bulletPoint}>• Facilitate ride bookings and connections between riders and drivers</Text>
        <Text style={styles.bulletPoint}>• Process payments and prevent fraud</Text>
        <Text style={styles.bulletPoint}>• Provide customer support and respond to inquiries</Text>
        <Text style={styles.bulletPoint}>• Improve app functionality and user experience</Text>
        <Text style={styles.bulletPoint}>• Send service updates, promotional offers, and notifications</Text>
        <Text style={styles.bulletPoint}>• Ensure safety and security of all users</Text>
        <Text style={styles.bulletPoint}>• Comply with legal obligations and enforce our Terms and Conditions</Text>
        <Text style={styles.bulletPoint}>• Conduct analytics and research to improve our services</Text>

        <Text style={styles.sectionTitle}>3. Information Sharing and Disclosure</Text>
        
        <Text style={styles.subSectionTitle}>3.1 With Other Users</Text>
        <Text style={styles.paragraph}>
          When you book a ride, we share your name, photo, pickup location, and contact information with your assigned driver. 
          Similarly, drivers&apos; information is shared with riders.
        </Text>

        <Text style={styles.subSectionTitle}>3.2 With Service Providers</Text>
        <Text style={styles.paragraph}>We share data with trusted third-party service providers who assist us with:</Text>
        <Text style={styles.bulletPoint}>• Payment processing</Text>
        <Text style={styles.bulletPoint}>• Cloud storage and hosting</Text>
        <Text style={styles.bulletPoint}>• Analytics and performance monitoring</Text>
        <Text style={styles.bulletPoint}>• Customer support tools</Text>
        <Text style={styles.bulletPoint}>• Marketing and communication services</Text>

        <Text style={styles.subSectionTitle}>3.3 For Legal Reasons</Text>
        <Text style={styles.paragraph}>We may disclose your information if required to:</Text>
        <Text style={styles.bulletPoint}>• Comply with legal obligations, court orders, or government requests</Text>
        <Text style={styles.bulletPoint}>• Enforce our Terms and Conditions</Text>
        <Text style={styles.bulletPoint}>• Protect the rights, property, or safety of Pantra, our users, or the public</Text>
        <Text style={styles.bulletPoint}>• Investigate fraud, security issues, or technical problems</Text>

        <Text style={styles.subSectionTitle}>3.4 Business Transfers</Text>
        <Text style={styles.paragraph}>
          In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.
        </Text>

        <Text style={styles.sectionTitle}>4. Data Retention</Text>
        <Text style={styles.paragraph}>
          We retain your personal information for as long as necessary to provide our services and comply with legal obligations. 
          Ride history and transaction records are retained for a minimum of 7 years as required by Nigerian financial regulations.
        </Text>
        <Text style={styles.paragraph}>
          You may request deletion of your account at any time, subject to legal retention requirements.
        </Text>

        <Text style={styles.sectionTitle}>5. Data Security</Text>
        <Text style={styles.paragraph}>
          We implement industry-standard security measures to protect your information, including:
        </Text>
        <Text style={styles.bulletPoint}>• Encryption of data in transit and at rest</Text>
        <Text style={styles.bulletPoint}>• Secure authentication protocols</Text>
        <Text style={styles.bulletPoint}>• Regular security audits and vulnerability assessments</Text>
        <Text style={styles.bulletPoint}>• Access controls and employee training</Text>
        <Text style={styles.paragraph}>
          However, no method of transmission over the internet is 100% secure. While we strive to protect your data, 
          we cannot guarantee absolute security.
        </Text>

        <Text style={styles.sectionTitle}>6. Your Rights Under NDPR</Text>
        <Text style={styles.paragraph}>Under the Nigeria Data Protection Regulation, you have the right to:</Text>
        <Text style={styles.bulletPoint}>• Access your personal data</Text>
        <Text style={styles.bulletPoint}>• Correct inaccurate or incomplete information</Text>
        <Text style={styles.bulletPoint}>• Request deletion of your data (subject to legal requirements)</Text>
        <Text style={styles.bulletPoint}>• Object to processing of your data</Text>
        <Text style={styles.bulletPoint}>• Withdraw consent at any time</Text>
        <Text style={styles.bulletPoint}>• Lodge a complaint with the Nigeria Data Protection Commission (NDPC)</Text>
        <Text style={styles.paragraph}>
          To exercise these rights, please contact us at pantrateam@gmail.com.
        </Text>

        <Text style={styles.sectionTitle}>7. Location Data Controls</Text>
        <Text style={styles.paragraph}>
          You can control location permissions through your device settings. However, disabling location services will 
          prevent you from using core features of the Pantra App, including ride booking and navigation.
        </Text>

        <Text style={styles.sectionTitle}>8. Marketing Communications</Text>
        <Text style={styles.paragraph}>
          You may opt out of promotional emails and notifications at any time by:
        </Text>
        <Text style={styles.bulletPoint}>• Clicking the unsubscribe link in our emails</Text>
        <Text style={styles.bulletPoint}>• Adjusting notification settings in the app</Text>
        <Text style={styles.bulletPoint}>• Contacting us directly</Text>
        <Text style={styles.paragraph}>
          Please note that you cannot opt out of service-related communications (e.g., ride confirmations, account updates).
        </Text>

        <Text style={styles.sectionTitle}>9. Children&apos;s Privacy</Text>
        <Text style={styles.paragraph}>
          The Pantra App is not intended for users under 18 years of age. We do not knowingly collect personal information 
          from children. If we become aware that a child has provided us with personal data, we will take steps to delete 
          such information.
        </Text>

        <Text style={styles.sectionTitle}>10. International Data Transfers</Text>
        <Text style={styles.paragraph}>
          Your information may be transferred to and processed in countries outside Nigeria. We ensure that such transfers 
          comply with applicable data protection laws and that adequate safeguards are in place.
        </Text>

        <Text style={styles.sectionTitle}>11. Cookies and Tracking Technologies</Text>
        <Text style={styles.paragraph}>
          We use cookies and similar technologies to enhance user experience, analyze app performance, and deliver 
          personalized content. You can manage cookie preferences through your device settings.
        </Text>

        <Text style={styles.sectionTitle}>12. Changes to This Privacy Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. Any changes will be posted in the app with an updated 
          &quot;Last Updated&quot; date. Continued use of the app after changes constitutes acceptance of the revised policy.
        </Text>

        <Text style={styles.sectionTitle}>13. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have questions or concerns about this Privacy Policy or our data practices, please contact:
        </Text>
        <Text style={styles.paragraph}>
          Pantra Limited{'\n'}
          Data Protection Officer{'\n'}
          Abuja, Nigeria{'\n'}
          📧 Email: pantrateam@gmail.com
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>🔒 Your Privacy Matters</Text>
          <Text style={styles.bulletPoint}>• We comply with NDPR and Nigerian data protection laws</Text>
          <Text style={styles.bulletPoint}>• Your data is encrypted and securely stored</Text>
          <Text style={styles.bulletPoint}>• You have full control over your personal information</Text>
          <Text style={styles.bulletPoint}>• We never sell your data to third parties</Text>
          <Text style={styles.bulletPoint}>• Location data is used only for ride services and safety</Text>
        </View>

        <View style={styles.footer} />
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
  summaryBox: {
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#15803d',
    marginBottom: 12,
  },
  footer: {
    height: 20,
  },
});
