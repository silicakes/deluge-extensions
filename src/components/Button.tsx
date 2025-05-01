import { ComponentChildren, JSX } from 'preact';

// Define ButtonProps as intrinsic button props plus custom children prop
type ButtonProps = JSX.IntrinsicElements['button'] & {
  children: ComponentChildren;
};

export function Button({ className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
} 