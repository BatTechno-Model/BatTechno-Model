import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput';

/**
 * ChipPicker - Allows selecting from defaults + adding new values
 * - Shows default options as selectable chips
 * - "+ Add" button opens input for new value
 * - Autocomplete suggestions appear when typing (minChars=2 for skills/interests)
 * - Selected values shown as chips with remove button
 */
export default function ChipPicker({
  values = [],
  onChange,
  defaults = [],
  placeholder,
  suggestionKey,
  country,
  minChars = 2,
  t,
}) {
  const [showAddInput, setShowAddInput] = useState(false);
  const [newValue, setNewValue] = useState('');

  const handleToggle = (value) => {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  };

  const handleRemove = (value) => {
    onChange(values.filter((v) => v !== value));
  };

  const handleAddNew = (e) => {
    e.preventDefault();
    const trimmed = newValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setNewValue('');
      setShowAddInput(false);
    }
  };

  const handleValueChange = (e) => {
    const value = e.target.value;
    setNewValue(value);
    // If value matches a suggestion exactly and user hasn't typed more, auto-add on blur
    // But for now, let user click + button or press Enter
  };

  const handleAddClick = () => {
    setShowAddInput(true);
  };

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence>
            {values.map((value) => (
              <motion.div
                key={value}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-800 rounded-full text-xs font-medium"
              >
                <span>{value}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(value)}
                  className="hover:bg-primary-200 rounded-full p-0.5 transition"
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Default options as chips */}
      {defaults.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {defaults.map((defaultValue) => {
            const isSelected = values.includes(defaultValue);
            return (
              <button
                key={defaultValue}
                type="button"
                onClick={() => handleToggle(defaultValue)}
                className={`px-2 py-1 rounded-full text-xs font-medium transition ${
                  isSelected
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {defaultValue}
              </button>
            );
          })}
        </div>
      )}

      {/* Add new input */}
      <AnimatePresence>
        {showAddInput ? (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddNew}
            className="flex gap-2"
          >
            <div className="flex-1">
              <AutocompleteInput
                value={newValue}
                onChange={handleValueChange}
                placeholder={placeholder}
                suggestionKey={suggestionKey}
                country={country}
                minChars={minChars}
                t={t}
              />
            </div>
            <button
              type="submit"
              className="px-2 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddInput(false);
                setNewValue('');
              }}
              className="px-2 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              <X size={16} />
            </button>
          </motion.form>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            type="button"
            onClick={handleAddClick}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-primary-600 hover:text-primary-700 transition"
          >
            <Plus size={14} />
            <span className="font-medium">{t('addNew')}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
