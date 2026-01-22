import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';

/**
 * AutocompleteInput - Shows suggestions only after typing minChars characters
 * - Does NOT show suggestions on focus
 * - Only shows after user types minChars (default: 1, can be 2 for noisy fields)
 * - Hides dropdown if input matches an existing suggestion exactly
 * - Closes dropdown when suggestion is selected
 */
export default function AutocompleteInput({
  name,
  value,
  onChange,
  placeholder,
  suggestionKey,
  country,
  minChars = 1,
  className = '',
  t,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Fetch suggestions when input changes (with debounce)
  useEffect(() => {
    const query = inputValue.trim().toLowerCase();
    
    // Don't show suggestions if:
    // 1. Input is empty
    // 2. Input length < minChars
    if (!query || query.length < minChars) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Check if input exactly matches any suggestion (case-insensitive)
    const exactMatch = suggestions.some(
      (s) => s.value.toLowerCase() === query
    );
    if (exactMatch) {
      setShowSuggestions(false);
      return;
    }

    // Fetch suggestions
    setIsLoading(true);
    const timeoutId = setTimeout(() => {
      api
        .getSuggestions(suggestionKey, inputValue, country)
        .then((res) => {
          if (res.data && res.data.length > 0) {
            const filtered = res.data.filter(
              (s) => s.value.toLowerCase().startsWith(query)
            );
            setSuggestions(filtered);
            // Only show if there are suggestions and input doesn't exactly match
            const hasExactMatch = filtered.some(
              (s) => s.value.toLowerCase() === query
            );
            setShowSuggestions(filtered.length > 0 && !hasExactMatch);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        })
        .catch(() => {
          setSuggestions([]);
          setShowSuggestions(false);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [inputValue, suggestionKey, country, minChars]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (suggestionValue) => {
    setInputValue(suggestionValue);
    onChange({ target: { value: suggestionValue } });
    setShowSuggestions(false);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(e);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        name={name}
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent transition ${className}`}
      />
      
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto"
          >
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(suggestion.value)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition text-sm border-b border-gray-100 last:border-b-0"
              >
                {suggestion.value}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
