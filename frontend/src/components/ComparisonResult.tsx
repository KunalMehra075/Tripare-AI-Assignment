import { Award, Hotel, Building, Clock, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { SearchWorkflowResult } from '../types';
import { formatPrice } from '../lib/utils';

interface ComparisonResultProps {
  result: SearchWorkflowResult;
}

export const ComparisonResult: React.FC<ComparisonResultProps> = ({ result }) => {
  if (result.status === 'CANCELLED') {
    return (
      <Alert variant="warning" className="mt-6">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Workflow Cancelled</AlertTitle>
        <AlertDescription>
          {result.message || 'The search workflow was cancelled gracefully by user request.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (result.status === 'NO_HOTELS_FOUND') {
    return (
      <Alert variant="default" className="mt-6 bg-slate-50 border-slate-200">
        <Building className="h-4 w-4 text-slate-500" />
        <AlertTitle>No Hotels Found</AlertTitle>
        <AlertDescription>
          {result.message || 'Neither supplier returned any available hotels for the selected city and dates.'}
        </AlertDescription>
      </Alert>
    );
  }

  const { bestHotel, comparison } = result;
  const suppA = comparison.supplierA;
  const suppB = comparison.supplierB;

  // Compute price difference if both returned rates
  const hotelA = suppA?.hotels?.[0];
  const hotelB = suppB?.hotels?.[0];
  const hasBoth = hotelA && hotelB;
  const savings = hasBoth ? Math.abs(hotelA.price - hotelB.price) : 0;

  return (
    <div className="space-y-6 mt-6">
      {/* Best Rate Card */}
      {bestHotel && (
        <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 w-28 h-28 bg-emerald-100/50 rounded-full blur-2xl pointer-events-none" />
          
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge variant="success" className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />
                <span>Best Rate Available</span>
              </Badge>
              <span className="text-xs text-slate-500 font-mono">
                Workflow ID: {result.workflowId.slice(0, 18)}...
              </span>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900 mt-2 flex items-center gap-2">
              <Hotel className="w-6 h-6 text-emerald-600" />
              <span>{bestHotel.name}</span>
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-t border-emerald-100 pt-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  Winning Supplier
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default" className="text-sm px-3 py-1 font-semibold">
                    {bestHotel.supplier}
                  </Badge>
                  {savings > 0 && (
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Saves {formatPrice(savings, bestHotel.currency)} vs competitor
                    </span>
                  )}
                </div>
              </div>

              <div className="sm:text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  Total Rate
                </p>
                <p className="text-3xl font-extrabold text-slate-900">
                  {formatPrice(bestHotel.price, bestHotel.currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Side-by-side Supplier Breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
          Supplier Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Supplier A Card */}
          <Card className={`border ${bestHotel?.supplier === 'SupplierA' ? 'ring-2 ring-emerald-500/20 border-emerald-300' : 'border-slate-200'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Supplier A</span>
                {suppA?.status === 'SUCCESS' ? (
                  <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Responded</span>
                  </Badge>
                ) : suppA?.status === 'TIMED_OUT' ? (
                  <Badge variant="warning" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Timed out &gt;5s (Cancelled)</span>
                  </Badge>
                ) : suppA?.status === 'EMPTY' ? (
                  <Badge variant="secondary">Empty (0 hotels)</Badge>
                ) : (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Error</span>
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {suppA?.status === 'SUCCESS' && suppA.hotels.length > 0 ? (
                <div className="space-y-2">
                  {suppA.hotels.map((h) => (
                    <div key={h.hotelId} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-sm">
                      <span className="text-slate-700 font-medium">{h.name}</span>
                      <span className="font-semibold text-slate-900">{formatPrice(h.price, h.currency)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  {suppA?.error || 'No rates available from Supplier A'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Supplier B Card */}
          <Card className={`border ${bestHotel?.supplier === 'SupplierB' ? 'ring-2 ring-emerald-500/20 border-emerald-300' : 'border-slate-200'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Supplier B</span>
                {suppB?.status === 'SUCCESS' ? (
                  <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Responded</span>
                  </Badge>
                ) : suppB?.status === 'TIMED_OUT' ? (
                  <Badge variant="warning" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Timed out &gt;5s (Cancelled)</span>
                  </Badge>
                ) : suppB?.status === 'EMPTY' ? (
                  <Badge variant="secondary">Empty (0 hotels)</Badge>
                ) : (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Error</span>
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {suppB?.status === 'SUCCESS' && suppB.hotels.length > 0 ? (
                <div className="space-y-2">
                  {suppB.hotels.map((h) => (
                    <div key={h.hotelId} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-sm">
                      <span className="text-slate-700 font-medium">{h.name}</span>
                      <span className="font-semibold text-slate-900">{formatPrice(h.price, h.currency)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  {suppB?.error || 'No rates available from Supplier B'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
