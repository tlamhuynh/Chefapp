import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn utility function', () => {
  it('should combine simple class names', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('should ignore undefined, null, and false', () => {
    expect(cn('class1', undefined, 'class2', null, false, 'class3')).toBe('class1 class2 class3');
  });

  it('should merge tailwind classes properly', () => {
    // twMerge handles this: p-4 overrides px-2 and py-2
    expect(cn('px-2 py-2', 'p-4')).toBe('p-4');
  });

  it('should resolve conflicting tailwind classes', () => {
    // The later class overrides the earlier one
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    expect(cn('bg-white', 'bg-black')).toBe('bg-black');
  });

  it('should handle arrays', () => {
    expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3');
  });

  it('should handle objects with conditional classes', () => {
    expect(cn('class1', { class2: true, class3: false })).toBe('class1 class2');
  });

  it('should handle complex combinations', () => {
    expect(
      cn(
        'base-class',
        undefined,
        ['arr-class-1', 'arr-class-2'],
        { 'obj-class-1': true, 'obj-class-2': false },
        'text-red-500',
        'text-blue-500',
        'p-2',
        'px-4'
      )
    ).toBe('base-class arr-class-1 arr-class-2 obj-class-1 text-blue-500 p-2 px-4');
  });
});
