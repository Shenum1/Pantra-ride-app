import React, { useState } from 'react';
import { Platform, TouchableOpacity, Text, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface DatePickerFieldProps {
  value: string; // 'YYYY-MM-DD', or '' when unset
  onChange: (isoDate: string) => void;
  placeholder: string;
  minimumDate?: Date;
  maximumDate?: Date;
  borderColor: string;
  textColor: string;
  placeholderColor: string;
  testID?: string;
}

// @react-native-community/datetimepicker ships no web implementation (only native
// iOS/Android modules) — on web it renders nothing tappable, so the calendar never
// actually appears. A plain HTML5 <input type="date"> is the only reliable
// cross-browser calendar picker available here, so this branches on Platform.OS
// exactly like the rest of this codebase does (lib/supabase.ts, etc.) rather than
// splitting into a separate .web.tsx file. React.createElement (not JSX) is used
// for the web branch so this file still type-checks under React Native's JSX
// namespace, which doesn't declare 'input' as a valid intrinsic element.
export default function DatePickerField({
  value,
  onChange,
  placeholder,
  minimumDate,
  maximumDate,
  borderColor,
  textColor,
  placeholderColor,
  testID,
}: DatePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'date',
      value: value || '',
      min: minimumDate ? minimumDate.toISOString().slice(0, 10) : undefined,
      max: maximumDate ? maximumDate.toISOString().slice(0, 10) : undefined,
      onChange: (e: any) => onChange(e.target.value ?? ''),
      'data-testid': testID,
      style: {
        borderWidth: 1,
        borderColor,
        borderRadius: 10,
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 12,
        paddingBottom: 12,
        fontSize: 15,
        color: value ? textColor : placeholderColor,
        backgroundColor: 'transparent',
        fontFamily: 'inherit',
        width: '100%',
        boxSizing: 'border-box',
      },
    });
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.button, { borderColor }]}
        onPress={() => setShowPicker(true)}
        testID={testID}
      >
        <Text style={{ color: value ? textColor : placeholderColor }}>{value || placeholder}</Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_: DateTimePickerEvent, date?: Date) => {
            setShowPicker(false);
            if (date) onChange(date.toISOString().slice(0, 10));
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center' },
});
