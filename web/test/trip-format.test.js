import assert from 'node:assert/strict';
import test from 'node:test';
import { moneyInputProps } from '../src/features/trips/trip-format.js';
import { formatMoney, formatTripTitle } from '../src/features/trips/trip-format.js';

test('places the currency unit after the amount', () => {
  assert.equal(formatMoney('5000000', 'VND'), '5,000,000 ₫');
});

test('normalizes Vietnamese trip titles and removes spaces before punctuation', () => {
  assert.equal(formatTripTitle('Vu\u0303ng Ta\u0300u cuo\u0302\u0301i tua\u0302\u0300n , bie\u0302\u0309n va\u0300 ha\u0309i sa\u0309n'), 'Vũng Tàu cuối tuần, biển và hải sản');
});
test('groups all digits in money inputs and preserves the decimal value and caret', () => {
  let amount = '1234567.5';
  const props = () => moneyInputProps(amount, (updated) => { amount = updated; });
  assert.equal(props().value, '1.234.567,5');
  const input = {
    value: '19.234.567,5',
    selectionStart: 2,
    setSelectionRange(start) { this.selectionStart = start; },
  };
  props().onChange({ currentTarget: input, nativeEvent: { inputType: 'insertText', data: '9' } });
  assert.equal(amount, '19234567.5');
  assert.equal(input.value, '19.234.567,5');
  assert.equal(input.selectionStart, 2);

  amount = '1234';
  input.value = '1.234.';
  input.selectionStart = 6;
  props().onChange({ currentTarget: input, nativeEvent: { inputType: 'insertText', data: '.' } });
  assert.equal(input.value, '1.234,');
  assert.equal(amount, '1234.');
});
