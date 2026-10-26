/**
 * Unit conversion and display. Values are stored in canonical metric units
 * (kg, cm, metres); imperial is a display/input preference only.
 */
import type { Units } from '@/types/database';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;
const M_PER_MI = 1609.344;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inch: number) => inch * CM_PER_IN;

const round = (v: number, digits = 1) => Math.round(v * 10 ** digits) / 10 ** digits;

export function weightLabel(units: Units): 'kg' | 'lb' {
  return units === 'metric' ? 'kg' : 'lb';
}

export function lengthLabel(units: Units): 'cm' | 'in' {
  return units === 'metric' ? 'cm' : 'in';
}

/** Canonical kg → number in the user's unit. */
export function displayWeight(kg: number, units: Units): number {
  return round(units === 'metric' ? kg : kgToLb(kg));
}

/** User input in their unit → canonical kg (2 decimals, matching numeric(6,2)). */
export function toKg(value: number, units: Units): number {
  return round(units === 'metric' ? value : lbToKg(value), 2);
}

export function displayLength(cm: number, units: Units): number {
  return round(units === 'metric' ? cm : cmToIn(cm));
}

export function toCm(value: number, units: Units): number {
  return round(units === 'metric' ? value : inToCm(value), 2);
}

export function formatWeight(kg: number, units: Units): string {
  return `${displayWeight(kg, units)} ${weightLabel(units)}`;
}

export function formatDistance(meters: number, units: Units): string {
  if (units === 'metric') return meters >= 1000 ? `${round(meters / 1000, 2)} km` : `${Math.round(meters)} m`;
  return `${round(meters / M_PER_MI, 2)} mi`;
}

export function distanceToMeters(value: number, units: Units): number {
  return round(units === 'metric' ? value * 1000 : value * M_PER_MI, 2);
}

export function unitsLabel(units: Units): string {
  return units === 'metric' ? 'Metric (kg, km)' : 'Imperial (lb, mi)';
}
