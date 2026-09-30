"use client";
import { createContext, useContext, type ReactNode } from "react";
import { bookingLanguage, type BookingLanguage } from "@/lib/booking-locale";
const LanguageContext = createContext<BookingLanguage>("es");
export function BookingLanguageProvider({ language, children }: { language: unknown; children: ReactNode }) {
 return <LanguageContext.Provider value={bookingLanguage(language)}>{children}</LanguageContext.Provider>;
}
export function useBookingLanguage() { return useContext(LanguageContext); }
