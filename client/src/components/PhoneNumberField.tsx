import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { authColors } from '../theme/authColors';
import AuthInput from './AuthInput';

export type PhoneCountry = { iso2: string; name: string; dialCode: string };

export const defaultPhoneCountry: PhoneCountry = { iso2: 'YE', name: 'Yemen', dialCode: '+967' };

// These options match the seeded server country catalog.
const previewCountries: PhoneCountry[] = [
  defaultPhoneCountry,
  { iso2: 'SA', name: 'Saudi Arabia', dialCode: '+966' },
  { iso2: 'AE', name: 'United Arab Emirates', dialCode: '+971' },
  { iso2: 'OM', name: 'Oman', dialCode: '+968' },
  { iso2: 'QA', name: 'Qatar', dialCode: '+974' },
  { iso2: 'KW', name: 'Kuwait', dialCode: '+965' },
  { iso2: 'BH', name: 'Bahrain', dialCode: '+973' },
  { iso2: 'EG', name: 'Egypt', dialCode: '+20' },
  { iso2: 'JO', name: 'Jordan', dialCode: '+962' },
  { iso2: 'IQ', name: 'Iraq', dialCode: '+964' },
  { iso2: 'MA', name: 'Morocco', dialCode: '+212' },
  { iso2: 'DZ', name: 'Algeria', dialCode: '+213' },
  { iso2: 'TR', name: 'Turkey', dialCode: '+90' },
  { iso2: 'IN', name: 'India', dialCode: '+91' },
  { iso2: 'PK', name: 'Pakistan', dialCode: '+92' },
  { iso2: 'GB', name: 'United Kingdom', dialCode: '+44' },
  { iso2: 'US', name: 'United States', dialCode: '+1' },
  { iso2: 'CA', name: 'Canada', dialCode: '+1' },
];

type PhoneNumberFieldProps = {
  country: PhoneCountry;
  onCountryChange: (country: PhoneCountry) => void;
  number: string;
  onNumberChange: (number: string) => void;
  error?: string;
  editable?: boolean;
};

/**
 * Collects a country calling code and national number for either auth form.
 * 1. Show the selected country and an optional searchable list.
 * 2. Keep the phone input numeric and report field errors alongside it.
 */
export default function PhoneNumberField({
  country, onCountryChange, number, onNumberChange, error, editable = true,
}: PhoneNumberFieldProps) {
  const [listOpen, setListOpen] = useState(false);
  const [search, setSearch] = useState('');
  const matches = previewCountries.filter((option) =>
    `${option.name} ${option.iso2} ${option.dialCode}`.toLowerCase().includes(search.trim().toLowerCase()));

  // STEP 1: Keep the selector within the current form on narrow screens.
  return (
    <View>
      <Text style={styles.label}>Country code</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose country code"
        accessibilityState={{ expanded: listOpen, disabled: !editable }}
        disabled={!editable}
        onPress={() => setListOpen((open) => !open)}
        style={styles.selector}
      >
        <Text style={styles.selectorText}>{country.name} ({country.dialCode})</Text>
        <Text style={styles.selectorText}>{listOpen ? '▴' : '▾'}</Text>
      </Pressable>
      {listOpen ? (
        <View style={styles.options}>
          <TextInput
            accessibilityLabel="Search countries"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Search country or calling code"
            placeholderTextColor={authColors.muted}
            style={styles.search}
            value={search}
          />
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.optionList}>
            {matches.map((option) => (
              <Pressable key={option.iso2} accessibilityRole="button"
                onPress={() => { onCountryChange(option); setListOpen(false); setSearch(''); }}
                style={styles.option}>
                <Text style={styles.selectorText}>{option.name} ({option.dialCode})</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* STEP 2: Preserve leading zeroes in the local number until server normalization. */}
      <AuthInput label="Phone number" value={number}
        onChangeText={(text) => onNumberChange(text.replace(/\D/g, '').slice(0, 15))}
        error={error} autoComplete="tel-national" keyboardType="phone-pad" editable={editable} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: authColors.ink, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  selector: { minHeight: 48, paddingHorizontal: 14, marginBottom: 16, borderWidth: 1,
    borderColor: authColors.border, borderRadius: 10, backgroundColor: authColors.card,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectorText: { color: authColors.ink, fontSize: 15, flexShrink: 1 },
  options: { borderWidth: 1, borderColor: authColors.border, borderRadius: 10, marginBottom: 16,
    padding: 8, backgroundColor: authColors.card },
  search: { minHeight: 42, paddingHorizontal: 10, borderWidth: 1,
    borderColor: authColors.border, borderRadius: 8, color: authColors.ink },
  optionList: { maxHeight: 220 },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: authColors.border },
});
