import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react-native';

export default function TermsAndConditions() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Terms and Conditions',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color="#000" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>TERMS AND CONDITIONS</Text>
        
        <Text style={styles.effectiveDate}>Effective Date: January 1, 2025</Text>
        <Text style={styles.effectiveDate}>Last Updated: January 1, 2025</Text>
        
        <Text style={styles.paragraph}>
          These Terms and Conditions ("Terms") constitute a legally binding agreement between Pantra Limited, 
          a company duly incorporated under the laws of the Federal Republic of Nigeria ("Pantra", "we", "our", 
          or "us"), and you ("user", "rider", "driver", or "you") governing your access to and use of the Pantra 
          App and related services (collectively, the "Services").
        </Text>
        
        <Text style={styles.paragraph}>
          By downloading, installing, or using the Pantra App, you acknowledge that you have read, understood, 
          and agree to be bound by these Terms. If you do not agree, you may not access or use the Services.
        </Text>

        <Text style={styles.sectionTitle}>1. Description of Services</Text>
        <Text style={styles.paragraph}>
          Pantra provides a digital platform that connects independent third-party drivers ("Drivers") with users 
          seeking transportation services ("Riders").
        </Text>
        <Text style={styles.paragraph}>
          Pantra does not own, control, operate, or manage any vehicle. Drivers are independent contractors, not 
          employees, agents, or representatives of Pantra.
        </Text>
        <Text style={styles.paragraph}>
          Rides arranged through the Pantra App are private agreements between the Rider and the Driver.
        </Text>
        <Text style={styles.paragraph}>
          Pantra provides the technological platform only and bears no responsibility for any acts, omissions, or 
          liabilities of Drivers or Riders.
        </Text>

        <Text style={styles.sectionTitle}>2. Eligibility</Text>
        <Text style={styles.paragraph}>
          You must be at least 18 years old and legally capable of entering into binding contracts to use the Pantra App.
        </Text>
        <Text style={styles.paragraph}>By registering, you represent and warrant that:</Text>
        <Text style={styles.bulletPoint}>• The information provided is accurate and complete;</Text>
        <Text style={styles.bulletPoint}>• You will maintain the confidentiality of your login credentials;</Text>
        <Text style={styles.bulletPoint}>• You will comply with all applicable laws, regulations, and policies.</Text>

        <Text style={styles.sectionTitle}>3. Account Registration and Security</Text>
        <Text style={styles.paragraph}>
          Users must register an account to access Pantra services. You agree to:
        </Text>
        <Text style={styles.bulletPoint}>• Provide truthful and up-to-date information;</Text>
        <Text style={styles.bulletPoint}>• Keep your login credentials confidential;</Text>
        <Text style={styles.bulletPoint}>• Immediately notify Pantra of unauthorized account access.</Text>
        <Text style={styles.paragraph}>
          Pantra is not liable for any loss arising from your failure to secure your account.
        </Text>

        <Text style={styles.sectionTitle}>4. Use of the Services</Text>
        <Text style={styles.paragraph}>By using the Pantra App, you agree not to:</Text>
        <Text style={styles.bulletPoint}>• Engage in fraud, abuse, harassment, or unlawful activity;</Text>
        <Text style={styles.bulletPoint}>• Interfere with the platform's functionality or servers;</Text>
        <Text style={styles.bulletPoint}>• Attempt to manipulate pricing, referrals, or reward systems;</Text>
        <Text style={styles.bulletPoint}>• Create multiple accounts for fraudulent gain (including free ride abuse).</Text>
        <Text style={styles.paragraph}>
          Pantra reserves the right to suspend or terminate accounts engaged in misuse, without notice or liability.
        </Text>

        <Text style={styles.sectionTitle}>5. Free Rides and Promotions</Text>
        <Text style={styles.paragraph}>
          Pantra may, from time to time, offer free rides, discounts, or promotional credits to users.
        </Text>
        <Text style={styles.bulletPoint}>• These offers are non-transferable and may only be used as intended.</Text>
        <Text style={styles.bulletPoint}>
          • Pantra reserves the right to withdraw, modify, or cancel any promotional offer without notice.
        </Text>
        <Text style={styles.bulletPoint}>
          • Users found to be exploiting or abusing free rides (e.g., multiple accounts, fake referrals, fraudulent use) 
          will have their accounts immediately suspended or permanently terminated.
        </Text>
        <Text style={styles.bulletPoint}>
          • Pantra is under no obligation to compensate or reinstate any lost credits or promotional benefits resulting 
          from such abuse.
        </Text>

        <Text style={styles.sectionTitle}>6. Payments</Text>
        <Text style={styles.paragraph}>
          Riders agree to pay all fares and fees associated with rides booked via the Pantra App.
        </Text>
        <Text style={styles.bulletPoint}>
          • Payments are processed via secure third-party platforms such as Paystack, Chipper Cash, or PalmPay.
        </Text>
        <Text style={styles.bulletPoint}>
          • Pantra shall not be liable for any transaction failure, delay, or loss arising from third-party payment providers.
        </Text>
        <Text style={styles.bulletPoint}>• Fares may vary based on time, distance, traffic, and demand.</Text>
        <Text style={styles.bulletPoint}>
          • All transactions are final and non-refundable unless otherwise determined by Pantra.
        </Text>

        <Text style={styles.sectionTitle}>7. Driver Obligations</Text>
        <Text style={styles.paragraph}>Drivers must:</Text>
        <Text style={styles.bulletPoint}>• Hold valid licenses and meet all regulatory requirements;</Text>
        <Text style={styles.bulletPoint}>• Maintain vehicles in safe and roadworthy condition;</Text>
        <Text style={styles.bulletPoint}>• Refrain from any unsafe or unprofessional conduct.</Text>
        <Text style={styles.paragraph}>
          Drivers are solely responsible for compliance with local transportation, insurance, and tax obligations.
        </Text>

        <Text style={styles.sectionTitle}>8. Disclaimer and Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          Pantra provides the App and Services on an "as is" and "as available" basis without warranties of any kind.
        </Text>
        <Text style={styles.paragraph}>Pantra shall not be liable for:</Text>
        <Text style={styles.bulletPoint}>• Any personal injury, property damage, or loss incurred during rides;</Text>
        <Text style={styles.bulletPoint}>• Misconduct, negligence, or criminal acts by Drivers or Riders;</Text>
        <Text style={styles.bulletPoint}>• Delays, cancellations, or service interruptions;</Text>
        <Text style={styles.bulletPoint}>
          • Loss of data, revenue, or goodwill resulting from app downtime or cyber incidents.
        </Text>
        <Text style={styles.paragraph}>
          In any case, Pantra's total liability to any user shall not exceed the cost of the disputed ride.
        </Text>

        <Text style={styles.sectionTitle}>9. Data Privacy</Text>
        <Text style={styles.paragraph}>
          Pantra collects, processes, and stores user information in accordance with the Nigeria Data Protection 
          Regulation (NDPR).
        </Text>
        <Text style={styles.paragraph}>By using the App, you consent to the collection of your:</Text>
        <Text style={styles.bulletPoint}>• Location data (for safety and analytics);</Text>
        <Text style={styles.bulletPoint}>• Identity verification information;</Text>
        <Text style={styles.bulletPoint}>• Payment and transaction details.</Text>
        <Text style={styles.paragraph}>
          Pantra will not sell or disclose personal data to third parties, except where required by law or authorized 
          by the user.
        </Text>

        <Text style={styles.sectionTitle}>10. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          All rights, titles, and interests in the Pantra App, including its software, design, trademarks, and content, 
          are owned exclusively by Pantra Limited.
        </Text>
        <Text style={styles.paragraph}>
          Users are granted a limited, non-transferable license to use the App solely for personal, non-commercial purposes.
        </Text>
        <Text style={styles.paragraph}>
          Unauthorized reproduction, modification, or reverse engineering of the App is strictly prohibited.
        </Text>

        <Text style={styles.sectionTitle}>11. Regulatory Compliance</Text>
        <Text style={styles.paragraph}>
          Pantra complies with the Federal Competition and Consumer Protection Commission (FCCPC), NDPR, and other 
          Nigerian transport regulations.
        </Text>
        <Text style={styles.paragraph}>
          Drivers are independently responsible for ensuring compliance with state and local transport laws.
        </Text>
        <Text style={styles.paragraph}>
          Pantra may suspend operations in any area where regulatory or security risks arise.
        </Text>

        <Text style={styles.sectionTitle}>12. Indemnity</Text>
        <Text style={styles.paragraph}>
          You agree to indemnify and hold harmless Pantra, its affiliates, officers, and employees from any claim, loss, 
          or expense (including legal fees) arising out of your:
        </Text>
        <Text style={styles.bulletPoint}>• Violation of these Terms;</Text>
        <Text style={styles.bulletPoint}>• Misuse of the App;</Text>
        <Text style={styles.bulletPoint}>• Breach of any applicable law or third-party right.</Text>

        <Text style={styles.sectionTitle}>13. Dispute Resolution</Text>
        <Text style={styles.paragraph}>
          All disputes shall first be resolved amicably between the parties.
        </Text>
        <Text style={styles.paragraph}>
          If unresolved within 30 days, the dispute shall be referred to binding arbitration in Abuja, Nigeria, under 
          the Arbitration and Conciliation Act.
        </Text>
        <Text style={styles.paragraph}>
          Users waive any right to participate in class actions or public court proceedings against Pantra.
        </Text>

        <Text style={styles.sectionTitle}>14. Modification of Terms</Text>
        <Text style={styles.paragraph}>
          Pantra reserves the right to update or modify these Terms at any time.
        </Text>
        <Text style={styles.paragraph}>
          Any changes will take effect immediately upon posting in the App.
        </Text>
        <Text style={styles.paragraph}>
          Continued use of the App after such updates constitutes acceptance of the revised Terms.
        </Text>

        <Text style={styles.sectionTitle}>15. Termination</Text>
        <Text style={styles.paragraph}>
          Pantra may terminate or suspend any account, at its sole discretion, without notice, if the user breaches 
          these Terms or engages in fraudulent or unlawful activity.
        </Text>
        <Text style={styles.paragraph}>
          Upon termination, the user must cease all use of the App and its services.
        </Text>

        <Text style={styles.sectionTitle}>16. Governing Law</Text>
        <Text style={styles.paragraph}>
          These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria.
        </Text>

        <Text style={styles.sectionTitle}>17. Contact Information</Text>
        <Text style={styles.paragraph}>For inquiries or complaints, please contact:</Text>
        <Text style={styles.paragraph}>
          Pantra Limited{'\n'}
          Abuja, Nigeria
        </Text>
        <View style={styles.contactRow}>
          <Mail size={16} color="#333" />
          <Text style={styles.paragraph}>Email: pantrateam@gmail.com</Text>
        </View>

        <View style={styles.summaryBox}>
          <View style={styles.summaryTitleRow}>
            <CheckCircle size={16} color="#0369a1" />
            <Text style={styles.summaryTitle}>Legal Summary of Protections:</Text>
          </View>
          <Text style={styles.bulletPoint}>• Shields Pantra from lawsuits arising from accidents, payments, or misconduct.</Text>
          <Text style={styles.bulletPoint}>• Declares drivers as independent contractors (no employment liability).</Text>
          <Text style={styles.bulletPoint}>• Protects free-ride system from abuse.</Text>
          <Text style={styles.bulletPoint}>• Ensures NDPR compliance.</Text>
          <Text style={styles.bulletPoint}>• Requires arbitration in Abuja (not court).</Text>
          <Text style={styles.bulletPoint}>• Caps liability at the cost of a single ride.</Text>
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
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0369a1',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: -8,
  },
  footer: {
    height: 20,
  },
});
