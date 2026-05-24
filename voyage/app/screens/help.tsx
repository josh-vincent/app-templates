import React from 'react';
import { View, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { PARCHMENT } from '@/lib/theme';
import Header from '@/components/Header';
import ThemedText from '@/components/ThemedText';
import Expandable from '@/components/Expandable';
import Section from '@/components/layout/Section';
import Icon from '@/components/Icon';
import { Button } from '@/components/Button';
import AnimatedView from '@/components/AnimatedView';
import Divider from '@/components/layout/Divider';

// FAQ data
const faqData = [
  {
    id: '1',
    question: 'How do I search for flights?',
    answer: 'Open the Search tab, type or pick your origin and destination airports, choose dates and passengers, and tap "Show me flights". Voyage queries Duffel for live offers and ranks them by price; the lowest fare gets a green ribbon.'
  },
  {
    id: '2',
    question: 'What does Watch price do?',
    answer: 'Tapping Watch price on any offer adds that route to Tracked. Voyage will keep an eye on the fare and ping you when it drops. You can re-poll on demand with Check now, change the cadence (Daily / Weekly / Manual) with Scan, or stop watching with the trash icon.'
  },
  {
    id: '3',
    question: 'How does the AI Assistant work?',
    answer: 'The Assistant tab is a chat that can search flights, look up offers, plan itineraries, and start price tracking — all by routing through Duffel and the AI gateway. Try one of the suggested prompts ("Cheapest to Tokyo in June under $800") or type your own.'
  },
  {
    id: '4',
    question: 'What is Voyage\'s cancellation policy?',
    answer: 'Cancellations are governed by each Duffel offer\'s fare rules — visible on the offer-detail screen once you tap a result. Some test-mode offers are flagged "expires soon" and need to be reserved before a deadline. Real bookings inherit the airline\'s rules.'
  },
  {
    id: '5',
    question: 'How do I view a booked trip?',
    answer: 'Booked offers land on the Trips tab. Tap a trip to see the boarding-pass view, countdown to departure, and a checklist of items left to do before wheels up. Tracked routes you\'ve actually booked also surface a "Booked · view trip" pill on the Tracked tab.'
  },
  {
    id: '6',
    question: 'How does payment work?',
    answer: 'Voyage uses your saved payment method (Settings → Payments) for Duffel bookings. In test mode no real charge occurs; for live orders you are billed when the booking is confirmed. You can manage cards or set up Apple/Google Pay from the Payments page.'
  },
  {
    id: '7',
    question: 'Why does an offer say "expires soon"?',
    answer: 'Duffel holds offer prices for a short window — sometimes minutes, sometimes hours. The "expires soon" badge means the fare is close to that deadline. Reserve quickly or expect the offer to refresh at a different price.'
  },
  {
    id: '8',
    question: 'How do I change the display currency?',
    answer: 'Go to Settings → Currency, pick a currency, and tap Save. The new code (e.g. EUR - Euro) is stored locally and the Settings row updates immediately. Live Duffel quotes are still in their native currency for now.'
  }
];

// Contact information
const contactInfo = [
  {
    id: 'email',
    type: 'Email Support',
    value: 'support@voyage.app',
    icon: 'Mail' as const,
    action: () => Linking.openURL('mailto:support@voyage.app')
  },
  {
    id: 'phone',
    type: 'Travel Hotline',
    value: '+1 (800) 555-FARE',
    icon: 'Phone' as const,
    action: () => Linking.openURL('tel:+18005553273')
  },
  {
    id: 'hours',
    type: 'Support Hours',
    value: '24/7 Customer Support',
    icon: 'Clock' as const,
    action: undefined
  }
];

export default function HelpScreen() {
  return (
    <View className="flex-1 dark:bg-dark-primary" style={{ backgroundColor: PARCHMENT }}>
      <Header title="Help & Support" showBackButton />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <AnimatedView animation="fadeIn" duration={400}>
          {/* FAQ Section */}
          <Section 
            title="Frequently Asked Questions" 
            titleSize="xl" 
            className="px-global pt-6 pb-2"
          />
          
          <View className="px-global">
            {faqData.map((faq) => (
              <Expandable 
                key={faq.id}
                title={faq.question}
                className="py-1"
              >
                <ThemedText className="text-light-text dark:text-dark-text leading-6">
                  {faq.answer}
                </ThemedText>
              </Expandable>
            ))}
          </View>
          
          {/* Contact Section */}
          <Section
            title="Contact Us"
            titleSize="xl"
            className="px-global pb-2 mt-14"
            subtitle="We're here to help with your flights and travel needs"
          />
          
          <View className="px-global pb-8">
            {contactInfo.map((contact) => (
              <TouchableOpacity 
                key={contact.id}
                onPress={contact.action}
                disabled={!contact.action}
                className="flex-row items-center py-4 border-b border-light-secondary dark:border-dark-secondary"
              >
                <View className="w-10 h-10 rounded-full bg-light-secondary dark:bg-dark-secondary items-center justify-center mr-4">
                  <Icon name={contact.icon} size={20} />
                </View>
                <View>
                  <ThemedText className="text-sm text-light-subtext dark:text-dark-subtext">
                    {contact.type}
                  </ThemedText>
                  <ThemedText className="font-medium">
                    {contact.value}
                  </ThemedText>
                </View>
                {contact.action && (
                  <Icon name="ChevronRight" size={20} className="ml-auto text-light-subtext dark:text-dark-subtext" />
                )}
              </TouchableOpacity>
            ))}
            
            <Button 
              title="Contact Support" 
              iconStart="MessageCircle"
              className="mt-8"
              onPress={() => Linking.openURL('mailto:support@voyage.app')}
            />
          </View>
        </AnimatedView>
      </ScrollView>
    </View>
  );
}
