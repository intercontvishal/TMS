import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface Container {
  _id: string;
  containerNumber: string;
}

interface PhotoManagerProps {
  formId: string;
  containers: Container[];
  canUpload: boolean;
}

export function PhotoManager({ formId, containers, canUpload }: PhotoManagerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedContainer, setSelectedContainer] = useState<string>("all");
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const photos = useQuery(api.photos.getPhotos, { 
    formId: formId as any,
    containerId: selectedContainer !== "all" ? selectedContainer as any : undefined,
    category: selectedCategory !== "all" ? selectedCategory as any : undefined,
  }) || [];
  
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const uploadPhoto = useMutation(api.photos.uploadPhoto);
  const deletePhoto = useMutation(api.photos.deletePhoto);

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "container_exterior", label: "Container Exterior" },
    { value: "container_interior", label: "Container Interior" },
    { value: "documents", label: "Documents" },
    { value: "damage", label: "Damage" },
    { value: "other", label: "Other" },
  ];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);

    try {
      // Generate upload URL
      const uploadUrl = await generateUploadUrl();

      // Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await result.json();

      // Generate file hash (simple hash for demo)
      const fileHash = await generateFileHash(file);

      // Save photo metadata
      await uploadPhoto({
        formId: formId as any,
        containerId: selectedContainer !== "all" ? selectedContainer as any : undefined,
        storageId,
        category: selectedCategory !== "all" ? selectedCategory as any : "other",
        fileHash,
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      toast.success("Photo uploaded successfully!");
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      toast.error("Failed to upload photo: " + (error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) {
      return;
    }

    try {
      await deletePhoto({ photoId: photoId as any });
      toast.success("Photo deleted successfully");
    } catch (error) {
      toast.error("Failed to delete photo: " + (error as Error).message);
    }
  };

  // Simple file hash generation
  const generateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <h3 className="text-lg font-medium text-gray-900">Photos</h3>
        
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          {/* Filters */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>

          <select
            value={selectedContainer}
            onChange={(e) => setSelectedContainer(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Containers</option>
            {containers.map((container) => (
              <option key={container._id} value={container._id}>
                {container.containerNumber}
              </option>
            ))}
          </select>

          {/* Upload Button */}
          {canUpload && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {isUploading ? "Uploading..." : "Upload Photo"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {photos.map((photo) => (
            <div key={photo._id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="aspect-square">
                <img
                  src={photo.url || ""}
                  alt={photo.description || "Photo"}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    {photo.category.replace("_", " ")}
                  </span>
                  {canUpload && (
                    <button
                      onClick={() => handleDeletePhoto(photo._id)}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Delete
                    </button>
                  )}
                </div>
                {photo.description && (
                  <p className="text-sm text-gray-700 mb-2">{photo.description}</p>
                )}
                <div className="text-xs text-gray-500">
                  <p>Uploaded: {new Date(photo.uploadedAt).toLocaleDateString()}</p>
                  <p>Size: {(photo.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">No photos uploaded yet</p>
          {canUpload && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              Upload First Photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
