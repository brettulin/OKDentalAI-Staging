import { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';

export function useDebouncedSearch(initialValue: string = '', delay: number = 300) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [debouncedValue] = useDebounce(searchTerm, delay);
  
  return {
    searchTerm,
    setSearchTerm,
    debouncedValue,
    isDebouncing: searchTerm !== debouncedValue
  };
}