import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface ContainerManagerProps {
  formId: string;
  canEdit: boolean;
}

export function ContainerManager({ formId, canEdit }: ContainerManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const containers = useQuery(api.containers.getContainers, { formId: formId as any }) || [];
  const addContainer = useMutation(api.containers.addContainer);
  const removeContainer = useMutation(api.containers.removeContainer);

  const [containerData, setContainerData] = useState({
    containerNumber: "",
    sealNumber: "",
    doNumber: "",
    isoCode: "",
    containerType: "20ft",
    weight: "",
    length: "",
    width: "",
    height: "",
    sealIntact: true,
    damageReported: false,
    damageDescription: "",
  });

  const handleAddContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await addContainer({
        formId: formId as any,
        containerNumber: containerData.containerNumber,
        sealNumber: containerData.sealNumber,
        doNumber: containerData.doNumber,
        isoCode: containerData.isoCode,
        containerType: containerData.containerType,
        weight: parseFloat(containerData.weight) || 0,
        dimensions: {
          length: parseFloat(containerData.length) || 0,
          width: parseFloat(containerData.width) || 0,
          height: parseFloat(containerData.height) || 0,
        },
        sealIntact: containerData.sealIntact,
        damageReported: containerData.damageReported,
        damageDescription: containerData.damageReported ? containerData.damageDescription : undefined,
      });

      toast.success(`Container added ${result.isoValidated ? "(ISO validated)" : "(ISO validation failed)"}`);
      setShowAddForm(false);
      setContainerData({
        containerNumber: "",
        sealNumber: "",
        doNumber: "",
        isoCode: "",
        containerType: "20ft",
        weight: "",
        length: "",
        width: "",
        height: "",
        sealIntact: true,
        damageReported: false,
        damageDescription: "",
      });
    } catch (error) {
      toast.error("Failed to add container: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveContainer = async (containerId: string) => {
    if (!confirm("Are you sure you want to remove this container?")) {
      return;
    }

    try {
      await removeContainer({ containerId: containerId as any });
      toast.success("Container removed successfully");
    } catch (error) {
      toast.error("Failed to remove container: " + (error as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Containers</h3>
        {canEdit && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            Add Container
          </button>
        )}
      </div>

      {/* Add Container Form */}
      {showAddForm && canEdit && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900">Add New Container</h4>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <form onSubmit={handleAddContainer} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Container Number *
                </label>
                <input
                  type="text"
                  required
                  value={containerData.containerNumber}
                  onChange={(e) => setContainerData(prev => ({ ...prev, containerNumber: e.target.value.toUpperCase() }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., ABCD1234567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seal Number *
                </label>
                <input
                  type="text"
                  required
                  value={containerData.sealNumber}
                  onChange={(e) => setContainerData(prev => ({ ...prev, sealNumber: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Seal number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DO Number *
                </label>
                <input
                  type="text"
                  required
                  value={containerData.doNumber}
                  onChange={(e) => setContainerData(prev => ({ ...prev, doNumber: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Delivery Order number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ISO Code *
                </label>
                <input
                  type="text"
                  required
                  value={containerData.isoCode}
                  onChange={(e) => setContainerData(prev => ({ ...prev, isoCode: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ISO 6346 code"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Container Type *
                </label>
                <select
                  required
                  value={containerData.containerType}
                  onChange={(e) => setContainerData(prev => ({ ...prev, containerType: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="20ft">20ft Standard</option>
                  <option value="40ft">40ft Standard</option>
                  <option value="40ft_hc">40ft High Cube</option>
                  <option value="45ft">45ft</option>
                  <option value="refrigerated">Refrigerated</option>
                  <option value="open_top">Open Top</option>
                  <option value="flat_rack">Flat Rack</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (kg) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.1"
                  value={containerData.weight}
                  onChange={(e) => setContainerData(prev => ({ ...prev, weight: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.0"
                />
              </div>
            </div>

            {/* Dimensions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dimensions (meters) *
              </label>
              <div className="grid grid-cols-3 gap-4">
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={containerData.length}
                  onChange={(e) => setContainerData(prev => ({ ...prev, length: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Length"
                />
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={containerData.width}
                  onChange={(e) => setContainerData(prev => ({ ...prev, width: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Width"
                />
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={containerData.height}
                  onChange={(e) => setContainerData(prev => ({ ...prev, height: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Height"
                />
              </div>
            </div>

            {/* Condition Checks */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="sealIntact"
                  checked={containerData.sealIntact}
                  onChange={(e) => setContainerData(prev => ({ ...prev, sealIntact: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="sealIntact" className="text-sm font-medium text-gray-700">
                  Seal is intact
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="damageReported"
                  checked={containerData.damageReported}
                  onChange={(e) => setContainerData(prev => ({ ...prev, damageReported: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="damageReported" className="text-sm font-medium text-gray-700">
                  Damage reported
                </label>
              </div>

              {containerData.damageReported && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Damage Description *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={containerData.damageDescription}
                    onChange={(e) => setContainerData(prev => ({ ...prev, damageDescription: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe the damage..."
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Adding..." : "Add Container"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Container List */}
      <div className="space-y-4">
        {containers.map((container) => (
          <div key={container._id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <h4 className="text-lg font-medium text-gray-900">{container.containerNumber}</h4>
                <div className="flex items-center space-x-2">
                  {container.isoValidated ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ISO Valid
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      ISO Invalid
                    </span>
                  )}
                  {!container.sealIntact && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Seal Broken
                    </span>
                  )}
                  {container.damageReported && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Damage Reported
                    </span>
                  )}
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => handleRemoveContainer(container._id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Seal:</span>
                <span className="ml-2">{container.sealNumber}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">DO:</span>
                <span className="ml-2">{container.doNumber}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">ISO:</span>
                <span className="ml-2">{container.isoCode}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Type:</span>
                <span className="ml-2">{container.containerType}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Weight:</span>
                <span className="ml-2">{container.weight}kg</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Dimensions:</span>
                <span className="ml-2">
                  {container.dimensions.length}×{container.dimensions.width}×{container.dimensions.height}m
                </span>
              </div>
            </div>

            {container.damageReported && container.damageDescription && (
              <div className="mt-4 p-3 bg-red-50 rounded-md">
                <p className="text-sm font-medium text-red-800">Damage Report:</p>
                <p className="text-sm text-red-700">{container.damageDescription}</p>
              </div>
            )}
          </div>
        ))}

        {containers.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">No containers added yet</p>
            {canEdit && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Add First Container
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
