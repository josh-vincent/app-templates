import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Header from '@/components/Header';
import ThemedText from '@/components/ThemedText';
import { Button } from '@/components/Button';
import ThemedScroller from '@/components/ThemeScroller';
import Icon from '@/components/Icon';
import AnimatedView from '@/components/AnimatedView';
import { SUPPORTED_CURRENCIES, getCurrency, setCurrency } from '@/utils/currencyStorage';

interface Currency {
    code: string;
    title: string;
}

const CurrencyScreen = () => {
    const navigation = useNavigation();
    const [selectedCurrency, setSelectedCurrency] = useState("USD");

    useEffect(() => {
        getCurrency().then(setSelectedCurrency);
    }, []);

    const currencies: Currency[] = SUPPORTED_CURRENCIES;

    const saveSettings = async () => {
        await setCurrency(selectedCurrency);
        navigation.goBack();
    };

    return (
        <View className="flex-1 bg-light-bg dark:bg-dark-bg">
            <Header showBackButton
                title="Currency"
                rightComponents={[
                    <Button title="Save" onPress={saveSettings} />
                ]}
            />
            <ThemedScroller>
                {currencies.map((currency) => (
                    <CurrencyItem
                        key={currency.code}
                        title={currency.title}
                        code={currency.code}
                        selected={selectedCurrency === currency.code}
                        onSelect={() => setSelectedCurrency(currency.code)}
                    />
                ))}
            </ThemedScroller>
        </View>
    );
};

interface CurrencyItemProps {
    title: string;
    code: string;
    selected: boolean;
    onSelect: () => void;
}

const CurrencyItem = ({ title, code, selected, onSelect }: CurrencyItemProps) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onSelect}
            className={`flex-row items-center justify-between py-4 border-b border-light-secondary dark:border-dark-secondary ${selected ? 'opacity-100' : 'opacity-100 '}`}
        >
            <View>
                <ThemedText className='text-lg font-bold'>{code}</ThemedText>
                <ThemedText className="text-light-subtext dark:text-dark-subtext">{title}</ThemedText>
            </View>
            {selected &&
                <AnimatedView animation="bounceIn" duration={500}>
                    <Icon name="Check" size={25} />
                </AnimatedView>

            }
        </TouchableOpacity>
    );
};

export default CurrencyScreen;
