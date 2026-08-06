"use client";

import { useDropzone } from "react-dropzone";

type Props = {
  onFileSelect: (file: File) => void;
};

export default function FileUpload({
  onFileSelect,
}: Props) {
  const { getRootProps, getInputProps } =
    useDropzone({
      multiple: false,

      onDrop(files) {
        if (files.length > 0) {
          onFileSelect(files[0]);
        }
      },
    });

  return (
    <div
      {...getRootProps()}
      className="cursor-pointer px-3 py-2 rounded-lg hover:bg-zinc-800 transition"
    >
      <input {...getInputProps()} />

      📎
    </div>
  );
}