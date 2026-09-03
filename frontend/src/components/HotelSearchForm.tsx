import React, { useState } from 'react';
import { Search, Loader2, XCircle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select } from './ui/select';
import { SearchFormData, ScenarioType } from '../types';

interface HotelSearchFormProps {
  onSearch: (data: SearchFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const HotelSearchForm: React.FC<HotelSearchFormProps> = ({
  onSearch,
  onCancel,
  isLoading,
}) => {
  // Tomorrow's date formatted as YYYY-MM-DD
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultCheckIn = tomorrow.toISOString().split('T')[0];

  const checkoutDate = new Date();
  checkoutDate.setDate(checkoutDate.getDate() + 5);
  const defaultCheckOut = checkoutDate.toISOString().split('T')[0];

  const [city, setCity] = useState('Paris');
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [scenario, setScenario] = useState<ScenarioType>('normal');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    onSearch({ city, checkIn, checkOut, scenario });
  };

  return (
    <Card className="w-full shadow-sm border-slate-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <span>Search Hotel Rates</span>
          <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            Dual Supplier
          </span>
        </CardTitle>
        <CardDescription>
          Temporal orchestrates parallel calls to Supplier A and B, handles timeouts, and finds the best rate.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* City input */}
            <div className="space-y-1.5">
              <Label htmlFor="city">Destination City</Label>
              <Input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Paris, Tokyo, New York"
                required
                disabled={isLoading}
              />
            </div>

            {/* Check-in */}
            <div className="space-y-1.5">
              <Label htmlFor="checkIn">Check-in Date</Label>
              <Input
                id="checkIn"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {/* Check-out */}
            <div className="space-y-1.5">
              <Label htmlFor="checkOut">Check-out Date</Label>
              <Input
                id="checkOut"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Scenario simulator */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="scenario" className="text-xs text-slate-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Simulation Scenario (Assignment Scenarios)</span>
              </Label>
            </div>
            <Select
              id="scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as ScenarioType)}
              disabled={isLoading}
              className="text-xs"
            >
              <option value="normal">Standard Production Search (Normal behavior)</option>
              <option value="supplierA_cheaper">Scenario 1: Supplier A cheaper ($90 vs $130)</option>
              <option value="supplierB_cheaper">Scenario 2: Supplier B cheaper ($150 vs $85)</option>
              <option value="same_rate">Scenario 3: Same rate ($120 vs $120, deterministic pick)</option>
              <option value="supplierA_fails">Scenario 4: Supplier A fails (HTTP 500), B succeeds</option>
              <option value="both_fail">Scenario 5: Both fail (returns error)</option>
              <option value="supplierA_empty">Scenario 6: Supplier A returns empty, B succeeds</option>
              <option value="both_empty">Scenario 7: Both return empty ("No hotels found")</option>
              <option value="supplierA_slow">Scenario 8: Supplier A takes &gt;5s (Workflow cancels slow activity)</option>
              <option value="supplierA_flaky">Scenario 9: Supplier A fails 2x before 3rd attempt success</option>
            </Select>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {isLoading ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onCancel}
                className="flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Cancel Workflow</span>
              </Button>
            ) : null}

            <Button
              type="submit"
              disabled={isLoading}
              className="min-w-[140px] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Comparing...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search Rates</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
